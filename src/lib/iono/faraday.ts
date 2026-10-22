/**
 * Drop 356: rotación Faraday (rotación del plano de polarización)
 * integrando Ne del volumen vivo y el campo dipolar a lo largo del rayo HF.
 *
 * Unidades y constantes (V2/V3 del scout MINIMAX, 103_scout_356_minimax.md):
 *   - Forma SI:  Ω_rad = 2.36e4 · ∫ Ne[m⁻³]·B_par[T]·dl[m] / f_Hz²
 *   - B en nT:   Ω_rad = 2.36e-5 · ∫ Ne[m⁻³]·B_par[nT]·dl[m] / f_Hz²
 *   - B nT, f MHz: Ω_rad = 2.36e-17 · I / f_MHz²
 *     (I = ∫ Ne[m⁻³]·B_par[nT]·dl[m])
 *   - Ω_deg = 1.3522e-15 · I / f_MHz²   (la constante de este módulo)
 *
 * Convención de signo (V3): la constante es POSITIVA
 * (K = e³/(8π²ε₀m²c) = 2.36e4, B en T y f en Hz; idéntico a src/Utils/Igrf.h).
 * Esto da la magnitud con el sentido "componente de B a lo largo del rayo":
 * B_par > 0 ⇔ el rayo tiene componente a lo largo de +B (en el ecuador
 * magnético +B ≈ norte) da Ω > 0. NO es el rotation measure astronómico
 * (que lleva el signo del electrón: RM = −2.63e-13 ∫nB·dl); es su opuesto
 * por convención.
 *
 * Marco de B: magnetosphereField (dipolo IGRF-14 grado 1, época 2025.0
 * congelada sin variación secular, en nT, marco WEB — mismo marco que
 * latLonToVec3 de geo.ts). No hay armónicos de grado ≥ 2 ni SV.
 *
 * Puro: sin DOM ni three (solo geo, densityVolume, magnetosphere).
 */

import { latLonToVec3, vec3ToLatLon, R_EARTH_KM } from "./geo";
import { DensityVolume, sampleVolume, VOL_LOG_MIN, VOL_LOG_RANGE } from "./densityVolume";
import { magnetosphereField } from "./magnetosphere";

/**
 * Constante Ω_deg = K_deg · I / f_MHz² con I en [m⁻³·nT·m] y f en [MHz].
 * (V3: NO es la forma SI — la SI con B[T] y f[Hz] da 1.3522e6; este valor
 * corresponde a B en nT y f en MHz. Ver tabla de equivalencias arriba.)
 */
export const FARADAY_DEG_PER_MHZ2_NT = 1.3522e-15;

export interface FaradayPoint {
  lat: number; // grados
  lon: number; // grados [-180, 180]
  altKm: number; // km
  viable?: number; // 0 = salto no viable (filtro V5); ausente = tratar como viable
}

export interface FaradaySample {
  neM3: number; // densidad electrónica [m⁻³]
  bNt: [number, number, number]; // campo dipolar [nT] en marco escena
}

/**
 * Rotación Faraday (grados) integrada por punto medio de cada segmento
 * de la trayectoria en marco escena.
 *
 * - Segmentos degenerados (|Δp| < 1e-6 km) se descartan (V1: el punto de
 *   suelo duplicado entre saltos generaría unit(0)=NaN).
 * - Punto medio: interpolación 3D (rompe antimeridiano/polos sin aritmética
 *   de longitudes; vec3ToLatLon es la inversa exacta de latLonToVec3).
 * - Filtro V5: segmentos con viable===0 en cualquier extremo se omiten.
 * - null si <2 puntos, freq≤0, o cualquier valor no finito.
 */
export function faradayRotationDeg(
  points: FaradayPoint[],
  freqMHz: number,
  sample: (lat: number, lon: number, altKm: number) => FaradaySample
): number | null {
  if (points.length < 2) return null;
  if (!Number.isFinite(freqMHz) || freqMHz <= 0) return null;
  for (const p of points) {
    if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon) || !Number.isFinite(p.altKm)) {
      return null;
    }
  }

  let I = 0; // ∫ Ne[m⁻³]·B_par[nT]·dl[m]
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    // V5: saltos no viables no integran (viable constante por salto).
    if (a.viable === 0 || b.viable === 0) continue;

    const p0 = latLonToVec3(a.lat, a.lon, R_EARTH_KM + a.altKm); // km, marco escena
    const p1 = latLonToVec3(b.lat, b.lon, R_EARTH_KM + b.altKm);
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const dz = p1[2] - p0[2];
    const len = Math.hypot(dx, dy, dz); // km
    // V1: segmento degenerado (punto de suelo duplicado entre saltos ≥2).
    if (len < 1e-6) continue;
    const ux = dx / len;
    const uy = dy / len;
    const uz = dz / len;

    // Punto medio geográfico por interpolación 3D (anti-antimeridiano).
    const pmX = (p0[0] + p1[0]) / 2;
    const pmY = (p0[1] + p1[1]) / 2;
    const pmZ = (p0[2] + p1[2]) / 2;
    const ll = vec3ToLatLon(pmX, pmY, pmZ);
    const altMid = Math.hypot(pmX, pmY, pmZ) - R_EARTH_KM;

    const { neM3, bNt } = sample(ll.lat, ll.lon, altMid);
    if (!Number.isFinite(neM3) || !Number.isFinite(bNt[0]) || !Number.isFinite(bNt[1]) || !Number.isFinite(bNt[2])) {
      return null;
    }
    const bPar = bNt[0] * ux + bNt[1] * uy + bNt[2] * uz; // nT
    I += neM3 * bPar * (len * 1000); // dl en metros
  }

  return (FARADAY_DEG_PER_MHZ2_NT * I) / (freqMHz * freqMHz);
}

/**
 * Rotación Faraday usando el volumen vivo de densidad (Ne) y el dipolo
 * IGRF (B en nT) como sampler. Ne se desnormaliza con
 * 10^(VOL_LOG_MIN + VOL_LOG_RANGE · v) — el volumen ya almacena log10(Ne)
 * normalizado en [0,1] con Ne en m⁻³ (sin factor 1e6 adicional).
 *
 * Nota V8 (scout): los primeros puntos medios de cada subida caen bajo
 * 60 km (base del volumen) y sampleVolume los clampa a la capa de 60 km.
 * Es un sesgo de ~0.02 % sobre el total; NO "arreglarlo" introduciendo
 * correcciones: el clamp es el comportamiento correcto del sampler.
 */
export function volumeFaradayDeg(
  points: FaradayPoint[],
  freqMHz: number,
  v: DensityVolume | null
): number | null {
  if (!v || !v.valid || v.data.length === 0) return null;
  return faradayRotationDeg(points, freqMHz, (lat, lon, altKm) => {
    const norm = sampleVolume(v, lat, lon, altKm);
    const neM3 = Math.pow(10, VOL_LOG_MIN + VOL_LOG_RANGE * norm);
    const bNt = magnetosphereField(lat, lon, altKm);
    return { neM3, bNt };
  });
}
