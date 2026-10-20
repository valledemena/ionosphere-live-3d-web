/**
 * Posición solar (Meeus de baja precisión) — port de src/Utils/SolarPosition.cpp
 * Devuelve dirección unitaria del sol y punto subsolar (lat, lon).
 *
 * MARCOS (ruling 174 n1, fix coordinado 175, drop 349): dir vive en el marco
 * MOTOR (token-identico a SolarPosition::getDirection, paridad <=4.6e-7); el
 * subsolar se decodifica con la inversa MOTOR (motorToLatLon), NO con
 * vec3ToLatLon (inversa escena: daba verdad+180). La escena Three.js
 * (latLonToVec3, SphereGeometry, texturas) está rotada 180° en longitud
 * respecto al motor: scene = (-motor.x, motor.y, -motor.z). Desde el drop
 * 349 los uniforms uSunDir/godrays/sunGlow usan sunDirScene (escena); la
 * física (buildLivePeakGrids/buildLiveVolume) sigue con getSunInfo().dir
 * (motor). El comentario del fix 175 que dejaba el alumbrado "latente"
 * queda superado por ese helper.
 */

import { DEG, RAD } from "./geo";
import { densityDir } from "./densityVolume";

export interface SunInfo {
  dir: [number, number, number];
  subsolarLat: number;
  subsolarLon: number;
}

export function getSunInfo(utcSeconds: number): SunInfo {
  // H1-261: Unix->J2000 son MENOS 10957.5 dias (el + heredado del C++
  // computaba el sol 60 anos julianos adelante; lambda y GMST se
  // cancelaban en longitud pero la declinacion quedaba ~0.17 desviada).
  const j2000 = utcSeconds / 86400.0 - 10957.5; // días desde J2000.0
  const T = j2000 / 36525.0; // siglos

  const L0 = mod(280.46646 + 36000.76983 * T + 0.0003032 * T * T, 360.0);
  const M = mod(357.52911 + 35999.05029 * T - 0.0001537 * T * T, 360.0);
  const Mrad = M * DEG;

  const C =
    (1.914602 - 0.004817 * T) * Math.sin(Mrad) +
    (0.019993 - 0.000101 * T) * Math.sin(2.0 * Mrad) +
    0.000289 * Math.sin(3.0 * Mrad);

  const lonEcl = (L0 + C) * DEG;
  const obliquity = (23.439291 - 0.0130042 * T) * DEG;

  const x = Math.cos(lonEcl);
  const y = Math.sin(lonEcl) * Math.cos(obliquity);
  const z = Math.sin(lonEcl) * Math.sin(obliquity);

  const GMST = mod(280.46061837 + 360.98564736629 * j2000 + 0.000387933 * T * T, 360.0);
  const rotation = GMST * DEG;

  const fx = x * Math.cos(rotation) + y * Math.sin(rotation);
  const fy = -x * Math.sin(rotation) + y * Math.cos(rotation);

  const dir: [number, number, number] = normalize([-fx, z, fy]);
  const { lat, lon } = motorToLatLon(dir[0], dir[1], dir[2]);
  return { dir, subsolarLat: lat, subsolarLon: lon };
}

/**
 * Inversa de densityDir (marco motor -> geografico). Verifica:
 * motorToLatLon(densityDir(la, lo)) == (la, lo). NO usar vec3ToLatLon aqui
 * (convencion opuesta +X=lon0: desplazaba el subsolar +180, n1 de 174).
 */
export function motorToLatLon(x: number, y: number, z: number): { lat: number; lon: number } {
  const r = Math.sqrt(x * x + y * y + z * z) || 1;
  const lat = Math.asin(y / r) * RAD;
  let lon = 180 - (Math.atan2(z, x) * RAD);
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}

function normalize(v: [number, number, number]): [number, number, number] {
  const m = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
}

/** Vector solar unitario en el marco ESCENA de Three.js.
 *  getSunInfo().dir vive en el marco motor; densidadDir y la física lo usan.
 *  La escena (latLonToVec3, SphereGeometry, texturas) está rotada 180° en lon:
 *  scene = (-motor.x, motor.y, -motor.z). */
export function sunDirScene(utcSeconds: number): [number, number, number] {
  const d = getSunInfo(utcSeconds).dir;
  return [-d[0], d[1], -d[2]];
}

function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

/** Angulo cenital solar (grados) para un punto dado (marco motor: punto y sol) */
export function solarZenithDeg(latDeg: number, lonDeg: number, utcSeconds: number): number {
  const { dir } = getSunInfo(utcSeconds);
  const [px, py, pz] = densityDir(latDeg, lonDeg);
  const d = px * dir[0] + py * dir[1] + pz * dir[2];
  return Math.acos(Math.max(-1, Math.min(1, d))) * RAD;
}
