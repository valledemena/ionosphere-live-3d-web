/**
 * W-4 F2a #2 fadeout global (ruling 266, oraculo O2). Puro: sin DOM ni red.
 *
 * REFERENCIA PINEADA (regla 252, ANTES de codigo):
 * (a) Wait & Spies, NBS TN 300 (1964) — PDF recuperado del NIST
 *     (nvlpubs, 4.7 MB, verificada viva 2026-10-14), transcrito del texto:
 *     eq(1)  wr = w0^2 / nu          (conductivity parameter)
 *     eq(2)  nu(h) = 5e6 * exp[-0.15*(h-70)] s^-1   (collision profile)
 *     eq(3)  wr(h) = 2.5e5 * exp[beta*(h-hp)] s^-1 (day beta=0.3,
 *            night beta=0.5; reference height hp, daytime 70 km)
 *     Ne(h) sale por algebra EXACTA (sin inventar): Ne = eps0*me*wr*nu/e^2.
 *     PCA: "within the polar cap region (latitudes greater than 60
 *     deg)... called PCA's" — el umbral geografico |lat|>=60 sale DEL
 *     PROPIO documento. Curvas PCA de Belrose (1964) con 0.9 y 3 dB a
 *     30 Mc/s citadas como procedencia (sin forma cerrada en el libro).
 *     DESVIACION DECLARADA (a adjudicar, precedente S98 del 254): el
 *     ruling pide "Wait & Spies 1971 (perfil D vs X-ray)"; tras 4
 *     busquedas (OpenAlex/SemanticScholar) no se localiza un 1971 de
 *     Wait&Spies sobre perfil D vs X-ray. Se implementa la forma
 *     EXACTA 1964 + escalado flare por el S&W pineado de #3
 *     (A = 4.5*(F/1e-6)^0.75 de dia, dRegionAbsorptionDb — cero curvas
 *     nuevas: el mapa global es S&W por celda).
 * (b) GOES verdad de ENTRADA (verificadas vivas 2026-10-14):
 *     XRS 1-day {time_tag, satellite, flux, energy} (sat 18) y
 *     protones integrales 1-day {time_tag, satellite 18, flux, energy
 *     ">=10 MeV"...">=500 MeV"}.
 * (c) NOAA S1: PCA desde 10 pfu en >=10 MeV (umbral DECLARADO pineado).
 * (d) D-RAP validacion: images/animations/d-rap/global/latest.png +
 *     north/south-pole + global_f05..f25 (verificadas vivas 200).
 *
 * Negativos O2: sin flare elegible -> mapa quiet (el mapa es X-ray + PCA;
 * lo auroral Kp vive en la demo abs por-enlace, no duplicado aqui);
 * noche NUNCA afectada por X-ray (dayFactor=0 por construccion);
 * PCA solo sobre el umbral declarado.
 */

import { solarZenithDeg } from "./solar";
import { dRegionAbsorptionDb } from "./ionomath";

export const WS_BETA_DAY = 0.3; // TN300: daytime beta
export const WS_BETA_NIGHT = 0.5; // TN300: nighttime beta
export const WS_HPRIME_DAY = 70; // km, daytime reference height
export const WS_OMEGA_REF = 2.5e5; // s^-1, eq(3) prefactor
export const WS_NU_REF = 5e6; // s^-1, eq(2) prefactor
export const WS_NU_SLOPE = 0.15; // km^-1, eq(2) exponente

/** TN300 eq(2): perfil de colisiones (s^-1). TU: nu(70) == 5e6. */
export function waitSpiesNu(hKm: number): number {
  return WS_NU_REF * Math.exp(-WS_NU_SLOPE * (hKm - WS_HPRIME_DAY));
}

/** TN300 eq(3): conductivity parameter (s^-1). TU: wr(70) == 2.5e5. */
export function waitSpiesOmega(hKm: number, beta: number, hPrime: number): number {
  return WS_OMEGA_REF * Math.exp(beta * (hKm - hPrime));
}

const EPS0 = 8.854187817e-12;
const ME = 9.10938356e-31;
const QE = 1.602176634e-19;

/**
 * Ne(h) en m^-3 por algebra EXACTA de eq(1): Ne = eps0*me*wr*nu/e^2.
 * Autoconsistencia del libro: Ne(70, dia) ~= 3.93e8 m^-3 (393 cm^-3).
 */
export function waitSpiesNe(hKm: number, beta: number, hPrime: number): number {
  const wr = waitSpiesOmega(hKm, beta, hPrime);
  const nu = waitSpiesNu(hKm);
  return (EPS0 * ME * wr * nu) / (QE * QE);
}

export const PCA_PFU_THRESHOLD = 10; // NOAA S1, >=10 MeV (declarado)
export const PCA_LAT = 60; // TN300: "latitudes greater than 60 deg"
export const PCA_DB_PER_DECADE = 2.0; // mapeo display declarado (como x1.6)

/** Termino PCA polar (dB): 0 bajo el umbral; declarado arriba. */
export function pcaDb(protonFlux10MeV: number, latDeg: number): number {
  if (!(protonFlux10MeV >= PCA_PFU_THRESHOLD)) return 0;
  if (Math.abs(latDeg) < PCA_LAT) return 0;
  return PCA_DB_PER_DECADE * Math.log10(protonFlux10MeV / PCA_PFU_THRESHOLD);
}

export interface ProtonPt {
  t: number;
  f: number; // pfu
}

/** Ultimo flujo >=10 MeV (verdad de entrada para PCA). */
export function latestProtonFlux(series: ProtonPt[], nowMs: number): number {
  let best = 0;
  for (const p of series) {
    if (p.t <= nowMs && p.f > best) best = p.f;
  }
  return best;
}

export const FADEOUT_W = 72;
export const FADEOUT_H = 36;

/**
 * Mapa global de absorcion (dB por celda, fila 0 = norte): S&W pineado
 * por celda (O2: generalizacion por-enlace -> mapa) + PCA polar.
 * Puro en (flux, kp, pflux, epoch): replay determinista.
 */
export function fadeoutGrid(
  xrayFlux: number,
  kp: number,
  protonFlux: number,
  epochSec: number,
  w = FADEOUT_W,
  h = FADEOUT_H
): Float32Array {
  const out = new Float32Array(w * h);
  for (let j = 0; j < h; j++) {
    const lat = 90 - (j + 0.5) * (180 / h);
    const pca = pcaDb(protonFlux, lat);
    for (let i = 0; i < w; i++) {
      const lon = (i + 0.5) * (360 / w) - 180;
      const zen = solarZenithDeg(lat, lon, epochSec);
      const cosChi = Math.cos((zen * Math.PI) / 180);
      out[j * w + i] = dRegionAbsorptionDb(cosChi, xrayFlux, 0) + pca;
    }
  }
  return out;
}

export interface FadeoutStats {
  maxDb: number;
  maxLat: number;
  maxLon: number;
  areaPct: number; // % celdas con >3 dB
  quiet: boolean; // sin flare elegible (O2 negativo)
}

/** Foto del mapa para el panel (misma grid que la escena: no discrepan). */
export function fadeoutStats(grid: Float32Array, w: number, h: number, xrayFlux: number): FadeoutStats {
  let maxDb = 0;
  let mi = 0;
  let n = 0;
  for (let k = 0; k < grid.length; k++) {
    if (grid[k] > maxDb) {
      maxDb = grid[k];
      mi = k;
    }
    if (grid[k] > 3) n++;
  }
  const j = Math.floor(mi / w);
  const i = mi % w;
  return {
    maxDb,
    maxLat: 90 - (j + 0.5) * (180 / h),
    maxLon: (i + 0.5) * (360 / w) - 180,
    areaPct: (100 * n) / grid.length,
    quiet: !(xrayFlux >= 1e-5),
  };
}
