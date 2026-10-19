/**
 * Trazado de rayos HF multi-salto entre dos puntos:
 *   - secante clásica con altura virtual (geometría real, no decorativa)
 *   - MUF por punto de reflexión (foF2 del grid + M(D) tipo ITU-R P.1240)
 *   - matriz de bandas: abierto / marginal / cerrado
 */

import {
  LatLon,
  greatCircleKm,
  slerpLatLon,
  hopGeometry,
  hopCountForDistance,
  bearingDeg,
} from "./geo";

export interface HopInfo {
  index: number;
  reflexion: LatLon; // punto de reflexión (centro del salto)
  hopKm: number;
  apexKm: number; // = altura virtual usada
  incidenceDeg: number;
  elevationDeg: number;
  foF2At: number; // MHz interpolado
  muf: number; // MUF(D) del salto
}

export interface LinkResult {
  a: LatLon;
  b: LatLon;
  distanceKm: number;
  bearingAB: number;
  bearingBA: number;
  hops: HopInfo[];
  mufLink: number; // mínimo MUF del circuito
  fotLink: number; // 0.85 × mufLink
  points3D: { lat: number; lon: number; altKm: number; hopIndex: number; viable: number }[];
  virtualHeight: number;
}

/** M(D) factor según ITU-R aproximado: M(D) = M3000·(D/3000)^0.24 */
function mFactor(hmF2: number, distanceKm: number): number {
  const m3000 = 1490 / (hmF2 + 216); // Dudeney
  return m3000 * Math.pow(Math.max(distanceKm, 200) / 3000, 0.24);
}

/**
 * Calcula el enlace completo A->B.
 * foF2At / hmF2At: muestreadores del grid (interpolados).
 */
export function computeLink(
  a: LatLon,
  b: LatLon,
  foF2At: (ll: LatLon) => number,
  hmF2At: (ll: LatLon) => number,
  freqMHz: number
): LinkResult {
  const distanceKm = greatCircleKm(a, b);
  const bearing = bearingDeg(a, b);
  const bearingBack = bearingDeg(b, a);

  // altura virtual: hmF2 del punto medio del circuito (aprox. robusta)
  const mid = slerpLatLon(a, b, 0.5);
  const hVirtual = Math.max(140, Math.min(420, hmF2At(mid)));

  const nHops = Math.max(1, hopCountForDistance(distanceKm, hVirtual));
  const perHopKm = distanceKm / nHops;

  // elevación necesaria para el salto con esa altura virtual
  const elev = elevationForHopSafe(perHopKm, hVirtual);

  const hops: HopInfo[] = [];
  const geo = hopGeometry(elev, hVirtual);
  for (let i = 0; i < nHops; i++) {
    const tMid = (i + 0.5) / nHops;
    const reflexion = slerpLatLon(a, b, tMid);
    const fo = foF2At(reflexion);
    const mufD = fo * mFactor(hVirtual, perHopKm);
    hops.push({
      index: i,
      reflexion,
      hopKm: perHopKm,
      apexKm: hVirtual,
      incidenceDeg: geo.incidenceDeg,
      elevationDeg: elev,
      foF2At: fo,
      muf: mufD,
    });
  }

  const mufLink = Math.min(...hops.map((h) => h.muf));
  const fotLink = 0.85 * mufLink;

  // Puntos 3D del trazado: para cada salto, segmentos rectos (rayos reales)
  // TX -> punto de reflexión (R+h sobre el punto medio) -> RX.
  const points3D: LinkResult["points3D"] = [];
  const SAMPLES_PER_LEG = 14;
  for (let i = 0; i < nHops; i++) {
    const hop = hops[i];
    const tGroundStart = i / nHops;
    const tGroundEnd = (i + 1) / nHops;
    const tMid = (i + 0.5) / nHops;
    const viable = hop.muf >= freqMHz ? (hop.muf >= freqMHz / 0.85 ? 1 : 0.5) : 0;
    // subida: del suelo al ápice (recta con interpolación de altitud)
    for (let s = 0; s <= SAMPLES_PER_LEG; s++) {
      const t = s / SAMPLES_PER_LEG;
      const g = slerpLatLon(a, b, tGroundStart + (tMid - tGroundStart) * t);
      points3D.push({
        lat: g.lat,
        lon: g.lon,
        altKm: hVirtual * t,
        hopIndex: i,
        viable,
      });
    }
    // bajada
    for (let s = 1; s <= SAMPLES_PER_LEG; s++) {
      const t = s / SAMPLES_PER_LEG;
      const g = slerpLatLon(a, b, tMid + (tGroundEnd - tMid) * t);
      points3D.push({
        lat: g.lat,
        lon: g.lon,
        altKm: hVirtual * (1 - t),
        hopIndex: i,
        viable,
      });
    }
  }

  return {
    a,
    b,
    distanceKm,
    bearingAB: Math.round(bearing),
    bearingBA: Math.round(bearingBack),
    hops,
    mufLink,
    fotLink,
    points3D,
    virtualHeight: hVirtual,
  };
}

function elevationForHopSafe(targetKm: number, hVirtual: number): number {
  // bisección sobre hopGeometry (salto decrece con la elevación)
  let lo = 1,
    hi = 88;
  const f = (e: number) => hopGeometry(e, hVirtual).hopKm - targetKm;
  if (f(lo) < 0) return lo;
  if (f(hi) > 0) return hi;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Estado de una banda para un enlace dado (f, muf, luf) */
export function bandStatus(freqMHz: number, muf: number, fot: number, luf: number): "open" | "marginal" | "closed" {
  if (freqMHz <= fot && freqMHz >= luf) return "open";
  if (freqMHz <= muf && freqMHz >= luf * 0.85) return "marginal";
  return "closed";
}

export const HF_BANDS: { name: string; f: number }[] = [
  { name: "160 m", f: 1.8 },
  { name: "80 m", f: 3.5 },
  { name: "60 m", f: 5.3 },
  { name: "40 m", f: 7.0 },
  { name: "30 m", f: 10.1 },
  { name: "20 m", f: 14.0 },
  { name: "17 m", f: 18.1 },
  { name: "15 m", f: 21.0 },
  { name: "12 m", f: 24.9 },
  { name: "10 m", f: 28.0 },
];
