/**
 * Rejilla de perfiles desde ionosondas W-3 (spec 166/168-P1, tramo rejilla):
 * port de interpLayerProfiles (App.cpp:676-766) + havDeg/modelFoF2/modelHmF2
 * (LayerProfile.h:153-224). IDW por campo con fondo de mediana, distancia
 * gran-circulo, mezcla medicion<->modelo SOLO en foF2/hmF2. Puro: sin DOM,
 * sin red (las muestras las entrega el caller; el fetch vive en la API).
 *
 * RELACION DECLARADA con geo.ts/ionomath.ts (P1-168): NO se reutiliza
 * idwInterpolate (era de valor unico, mediana estandar sobre todos los
 * valores, radio+C++ distintos menesteres) ni greatCircleDeg (nucleo por
 * verificar): se portean havDeg (haversine en grados, doble) y medOf
 * (mediana SUPERIOR solo de >0, como el oraculo) con TU. SI se reutiliza
 * smoothstep de ionomath (mismas aristas incl. invertidas 55->25) y
 * densityDir de densityVolume (marco del motor, ya certificado en 165).
 * dayOfYearUtc replica dayOfYear de ionomath (EQUIVALENCIA certificada en
 * el veredicto 170: identidad algebraica + 24106 dias + 200k epochs con 0
 * discrepancias, ambos 1..366 estilo gmtime; el supuesto off-by-one 0..365
 * de la nota 169 queda REFUTADO). Se mantiene la funcion local para la
 * firma del oraculo y su TU 1/365/366.
 * CONVENCION DE REJILLA del oraculo (replicada con su quirk): la rejilla
 * de perfiles usa ESQUINAS (latG = -90+cellLat*i, sin +0.5) mientras el
 * builder consume centros: desfase de media celda (1.25 grados) presente
 * en produccion C++ y replicado aqui (fidelidad sobre correccion).
 */
import { smoothstep } from "./ionomath";
import { applyDayNight, densityDir, extractPeakGrids, type DensityVolume } from "./densityVolume";
import { FO_TO_NM, buildDensityVolume, sanitizeB0, sanitizeB1, type LayerProfileTS } from "./layerProfile";

export interface ProfileSample {
  latDeg: number;
  lonDeg: number;
  foE: number;
  foF1: number;
  foF2: number;
  hmF2: number;
  B0: number;
  B1: number;
  valid: boolean;
  /** Fila stale (kc2g 6-24 h): fuera del volumen, como M4R-A del C++. */
  stale: boolean;
}

const IDW_MAX_DIST = 50; // grados
const IDW_BG = 0.004; // peso del fondo de mediana

// Distancia gran circulo haversine en GRADOS (port de havDeg).
export function havDeg(la1: number, lo1: number, la2: number, lo2: number): number {
  const kPi = Math.PI;
  const d2r = kPi / 180;
  const dla = (la2 - la1) * d2r;
  const dlo = (lo2 - lo1) * d2r;
  const a =
    Math.sin(dla / 2) * Math.sin(dla / 2) +
    Math.cos(la1 * d2r) * Math.cos(la2 * d2r) * Math.sin(dlo / 2) * Math.sin(dlo / 2);
  return (2 * Math.asin(Math.min(1, Math.sqrt(a)))) / d2r;
}

// Dia del ano UTC 1..366 (port de dayOfYear: gmtime tm_yday + 1).
export function dayOfYearUtc(epochSec: number): number {
  const d = new Date(epochSec * 1000);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86400000) + 1;
}

/** Vista minima de estacion web para el mapeo (null = ausente). */
export interface StationLike {
  lat: number;
  lon: number;
  foE: number | null;
  foF1: number | null;
  foF2: number | null;
  hmF2: number | null;
  B0: number | null;
  B1: number | null;
  history?: { t: string; foF2: number }[];
  // Stale declarado por la fuente (ruta); si ausente se calcula por edad.
  stale?: boolean;
}

// Banner del oraculo: muestra >6 h fuera de mapas (App.cpp:4326).
export const STALE_AFTER_MS = 6 * 3600_000;

/** Stale por edad del ultimo ionograma (solo con historia: sin evidencia
 *  de edad se considera viva, como el C++ con muestra actual). */
export function isStaleSample(history: { t: string; foF2: number }[] | undefined, nowMs: number): boolean {
  if (!history || !history.length) return false;
  const last = history[history.length - 1];
  const t = Date.parse(last.t.endsWith("Z") ? last.t : last.t + "Z");
  if (!isFinite(t)) return false;
  return nowMs - t > STALE_AFTER_MS;
}

/**
 * Mapeo estacion web -> ProfileSample (P1-170): copia de campos con
 * null/ausente -> 0; las puertas >0 de interpProfiles convierten el 0 en
 * fondo/mediana (exactamente como el C++ con dato ausente). IonosondeStation
 * es asignable a StationLike.
 */
export function stationToProfileSample(s: StationLike, nowMs: number = Date.now()): ProfileSample {
  return {
    latDeg: s.lat,
    lonDeg: s.lon,
    foE: s.foE ?? 0,
    foF1: s.foF1 ?? 0,
    foF2: s.foF2 ?? 0,
    hmF2: s.hmF2 ?? 0,
    B0: s.B0 ?? 0,
    B1: s.B1 ?? 0,
    valid: s.foF2 != null,
    // o5: stale declarado por la ruta, o por edad (>6 h fuera de mapas).
    stale: s.stale ?? isStaleSample(s.history, nowMs),
  };
}

export interface LivePeakGrids {
  /** foF2 derivado del pico (MHz), norte-primero como el shell. */
  fo: Float32Array;
  /** hmF2 derivado (km, hueco = 0), norte-primero. */
  hm: Float32Array;
  w: number;
  h: number;
}

/**
 * Rejilla viva W-3 (P1-172, primer tramo visual): estaciones ->
 * stationToProfileSample -> interpProfiles -> buildDensityVolume ->
 * extractPeakGrids -> grids DERIVADAS del volumen (pin 158 sec.5.4).
 * foF2 = sqrt(Ne_pico / 1.24e10) con Ne = 10^logNe; el hueco (logNe 8.0
 * -> 0.09 MHz, D-diurno logNe 9.0 -> 0.28 MHz) da suelo fisico sin inventar
 * dato. Norte-primero para el shell (flip desde sur-primero). Puro.
 */
/**
 * Volumen vivo W-3 (P2-182, tramo visual): la cadena completa hasta el
 * DensityVolume (mapper -> interp -> applyDayNight -> builder). La usan la
 * escena (textura 3D) y buildLivePeakGrids (shells derivadas). Puro.
 */
export function buildLiveVolume(
  stations: StationLike[],
  w: number,
  h: number,
  sunX: number,
  sunY: number,
  sunZ: number,
  epochSec: number,
  f107: number,
  altRes = 48,
  altMinKm = 60,
  altMaxKm = 500,
  flareFactor = 1
): DensityVolume {
  const samples = stations.map((s) => stationToProfileSample(s, epochSec * 1000));
  const profiles = interpProfiles(samples, w, h, sunX, sunY, sunZ, epochSec, f107);
  // P2-174 (App.cpp:2433): atenuar E/F1 nocturnas ANTES de construir (sin
  // esto el fondo mediano interpola densidad fantasma y el argmax nocturno
  // se queda en ~110 km). Misma cadena que el oraculo.
  applyDayNight(profiles, w, h, sunX, sunY, sunZ);
  return buildDensityVolume(
    profiles, w, h, altRes, altMinKm, altMaxKm, sunX, sunY, sunZ, flareFactor
  );
}

export function buildLivePeakGrids(
  stations: StationLike[],
  w: number,
  h: number,
  sunX: number,
  sunY: number,
  sunZ: number,
  epochSec: number,
  f107: number,
  altRes = 48,
  altMinKm = 60,
  altMaxKm = 500,
  flareFactor = 1
): LivePeakGrids {
  const fo = new Float32Array(w * h);
  const hm = new Float32Array(w * h);
  const vol = buildLiveVolume(
    stations, w, h, sunX, sunY, sunZ, epochSec, f107, altRes, altMinKm, altMaxKm, flareFactor
  );
  if (!vol.valid) return { fo, hm, w, h };
  const peaks = extractPeakGrids(vol);
  if (!peaks.logNe.valid) return { fo, hm, w, h };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const logNe = peaks.logNe.values[y * w + x];
      const f = Math.sqrt(Math.pow(10, logNe) / FO_TO_NM);
      const row = h - 1 - y; // sur-primero -> norte-primero
      fo[row * w + x] = f;
      hm[row * w + x] = peaks.hmKm.values[y * w + x];
    }
  }
  return { fo, hm, w, h };
}

// foF2 climatologico (MHz): nucleo con cosChi precalculado por el caller
// con la MISMA expresion que applyDayNight (P1 corregido por MUSE en C++).
export function modelFoF2Core(cosChi: number, latDeg: number, doy: number, f107: number): number {
  const lat = Math.abs(latDeg);
  const solar = 0.62 + 0.0046 * Math.min(220, Math.max(60, f107));
  const dayBase = 3.2 + 7.8 * Math.pow(Math.max(cosChi, 0), 0.7);
  const nightBase = 1.6 + 1.8 * Math.exp(-lat / 40);
  const t = smoothstep(-0.12, 0.15, cosChi);
  let fo = (1 - t) * nightBase + t * dayBase;
  const eq = Math.exp(-Math.pow((lat - 16) / 12, 2)) - 0.55 * Math.exp(-Math.pow(lat / 20, 2));
  fo *= 1 + 0.32 * eq * t;
  const seasonal = Math.cos(((doy - 172) / 365) * 2 * Math.PI) * (latDeg > 0 ? 1 : -1);
  fo *= 1 + 0.06 * seasonal * (lat / 90);
  return fo * solar;
}

// hmF2 climatologico (km): sube de noche.
export function modelHmF2Core(cosChi: number, latDeg: number): number {
  const lat = Math.abs(latDeg);
  const dayH = 250 - 0.35 * lat;
  const nightH = 300 + 0.2 * lat;
  const t = smoothstep(-0.12, 0.15, cosChi);
  return (1 - t) * nightH + t * dayH;
}

function blankLayerProfile(): LayerProfileTS {
  return {
    NmE: 0, hmE: 110,
    NmF1: 0, hmF1: 180,
    NmF2: 0, hmF2: 300, B0: 100, B1: 3,
    hasE: false, hasF1: false, hasF2: false,
  };
}

// Mediana SUPERIOR solo de >0 (oraculo medOf).
function medOf(vals: number[]): number {
  const v = vals.filter((x) => x > 0).sort((a, b) => a - b);
  if (!v.length) return 0;
  return v[Math.floor(v.length / 2)];
}

/**
 * Interpola perfiles de capa a la rejilla w*h (port de interpLayerProfiles).
 * Fondo = mediana por campo EXCEPTO foF2/hmF2, que mezclan el fondo
 * climatologico por cercania (wG). sunDir en el marco del motor (MISMO
 * vector que applyDayNight/buildDensityVolume). epochSec/f107 alimentan
 * el termino estacional del modelo.
 */
export function interpProfiles(
  samples: ProfileSample[],
  w: number,
  h: number,
  sunX: number,
  sunY: number,
  sunZ: number,
  epochSec: number,
  f107: number
): LayerProfileTS[] {
  const out: LayerProfileTS[] = [];
  for (let i = 0; i < w * h; i++) out.push(blankLayerProfile());
  const pts = samples.filter((s) => s.valid && !s.stale);
  if (!pts.length) return out;
  const cellLat = 180 / h;
  const cellLon = 360 / w;
  const fE = medOf(pts.map((p) => p.foE));
  const fF1 = medOf(pts.map((p) => p.foF1));
  const fF2 = medOf(pts.map((p) => p.foF2));
  const mNmE = fE > 0 ? 1.24e10 * fE * fE : 0;
  const mNmF1 = fF1 > 0 ? 1.24e10 * fF1 * fF1 : 0;
  const mNmF2 = fF2 > 0 ? 1.24e10 * fF2 * fF2 : 0;
  const hmedF2 = medOf(pts.map((p) => p.hmF2));
  const mB0 = sanitizeB0(medOf(pts.map((p) => p.B0)));
  const mB1 = sanitizeB1(medOf(pts.map((p) => p.B1)));
  const doy = dayOfYearUtc(epochSec);
  for (let latIdx = 0; latIdx < h; latIdx++) {
    const latG = -90 + cellLat * latIdx; // ESQUINAS (quirk del oraculo)
    for (let lonIdx = 0; lonIdx < w; lonIdx++) {
      const lonG = -180 + cellLon * lonIdx;
      let wNmE = IDW_BG, vNmE = IDW_BG * mNmE;
      let wNmF1 = IDW_BG, vNmF1 = IDW_BG * mNmF1;
      let wNmF2 = IDW_BG, vNmF2 = IDW_BG * mNmF2;
      let wHm = IDW_BG, vHm = IDW_BG * hmedF2;
      let wB0 = IDW_BG, vB0 = IDW_BG * mB0;
      let wB1 = IDW_BG, vB1 = IDW_BG * mB1;
      let nearDeg = 180;
      for (const p of pts) {
        const d = havDeg(latG, lonG, p.latDeg, p.lonDeg);
        if (d < nearDeg) nearDeg = d;
        if (d > IDW_MAX_DIST) continue;
        const wt = 1 / (d * d + 0.5);
        if (p.foE > 0) {
          wNmE += wt;
          vNmE += wt * 1.24e10 * p.foE * p.foE;
        }
        if (p.foF1 > 0) {
          wNmF1 += wt;
          vNmF1 += wt * 1.24e10 * p.foF1 * p.foF1;
        }
        if (p.foF2 > 0) {
          wNmF2 += wt;
          vNmF2 += wt * 1.24e10 * p.foF2 * p.foF2;
        }
        if (p.hmF2 > 0) {
          wHm += wt;
          vHm += wt * p.hmF2;
        }
        if (p.B0 > 0) {
          wB0 += wt;
          vB0 += wt * p.B0;
        }
        if (p.B1 > 0) {
          wB1 += wt;
          vB1 += wt * p.B1;
        }
      }
      // Mezcla medicion<->modelo SOLO en foF2 y hmF2, con el MISMO cosChi
      // que applyDayNight/buildDensityVolume (densityDir, marco del motor).
      const wG = smoothstep(55, 25, nearDeg);
      const [nx, ny, nz] = densityDir(latG, lonG);
      const cosChi = nx * sunX + ny * sunY + nz * sunZ;
      const pr = blankLayerProfile();
      pr.NmE = vNmE / wNmE;
      pr.hasE = pr.NmE > 0;
      pr.NmF1 = vNmF1 / wNmF1;
      pr.hasF1 = pr.NmF1 > 0;
      const nmF2Idw = vNmF2 / wNmF2;
      const hmF2Idw = vHm / wHm;
      const foF2Idw = nmF2Idw > 0 ? Math.sqrt(nmF2Idw / 1.24e10) : 0;
      const foF2Cell = wG * foF2Idw + (1 - wG) * modelFoF2Core(cosChi, latG, doy, f107);
      pr.NmF2 = 1.24e10 * foF2Cell * foF2Cell;
      const hmF2Cell =
        hmF2Idw > 0
          ? wG * hmF2Idw + (1 - wG) * modelHmF2Core(cosChi, latG)
          : modelHmF2Core(cosChi, latG);
      pr.hmF2 = hmF2Cell;
      pr.hasF2 = pr.NmF2 > 0 && pr.hmF2 > 0;
      pr.hmF1 = pr.hmF2 > 0 ? Math.max(150, 0.8 * pr.hmF2) : 180;
      pr.B0 = sanitizeB0(vB0 / wB0);
      pr.B1 = sanitizeB1(vB1 / wB1);
      out[latIdx * w + lonIdx] = pr;
    }
  }
  return out;
}
