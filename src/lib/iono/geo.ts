/**
 * Geodesia y conversiones coordenadas.
 * Convención del motor (idéntica a la del proyecto C++):
 *   - +Y = norte, lon 0 -> +X, lon 90E -> -Z
 *   - (x, y, z) = (-r·cos(φ)·cos(lat), r·sin(lat), r·sin(φ)·cos(lat)), φ = (lon+180)°
 */

export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const R_EARTH_KM = 6371;

export interface LatLon {
  lat: number; // grados
  lon: number; // grados [-180, 180]
}

export function latLonToVec3(latDeg: number, lonDeg: number, r = 1): [number, number, number] {
  const lat = latDeg * DEG;
  const phi = (lonDeg + 180) * DEG;
  return [
    -r * Math.cos(phi) * Math.cos(lat),
    r * Math.sin(lat),
    r * Math.sin(phi) * Math.cos(lat),
  ];
}

/** Inversa exacta de latLonToVec3 */
export function vec3ToLatLon(x: number, y: number, z: number): LatLon {
  const r = Math.sqrt(x * x + y * y + z * z) || 1;
  const lat = Math.asin(y / r) * RAD;
  // x = -cos(phi)cos(lat), z = sin(phi)cos(lat)
  let phi = Math.atan2(z, -x); // phi en [-pi, pi]
  let lon = phi * RAD - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return { lat, lon };
}

/** Distancia gran círculo (haversine), km */
export function greatCircleKm(a: LatLon, b: LatLon): number {
  const la1 = a.lat * DEG, la2 = b.lat * DEG;
  const dla = (b.lat - a.lat) * DEG, dlo = (b.lon - a.lon) * DEG;
  const h = Math.sin(dla / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dlo / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Punto a fracción t del gran círculo a->b (slerp sobre esfera unidad) */
export function slerpLatLon(a: LatLon, b: LatLon, t: number): LatLon {
  const va = latLonToVec3(a.lat, a.lon, 1);
  const vb = latLonToVec3(b.lat, b.lon, 1);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  if (omega < 1e-9) return { ...a };
  const s = Math.sin(omega);
  const cA = Math.sin((1 - t) * omega) / s;
  const cB = Math.sin(t * omega) / s;
  return vec3ToLatLon(
    cA * va[0] + cB * vb[0],
    cA * va[1] + cB * vb[1],
    cA * va[2] + cB * vb[2]
  );
}

/** Rumbo inicial (bearing) a->b en grados [0,360) */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const la1 = a.lat * DEG, la2 = b.lat * DEG;
  const dlo = (b.lon - a.lon) * DEG;
  const y = Math.sin(dlo) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dlo);
  return (Math.atan2(y, x) * RAD + 360) % 360;
}

/**
 * Geometría de un salto ionosférico (secante clásica, teorema del seno).
 * Dado ángulo de elevación beta (grados) y altura virtual h (km):
 *   i = arcsin( R·cos(beta) / (R+h) )      (ángulo de incidencia desde la vertical)
 *   medio-ángulo central = 90° - beta - i  (grados)
 *   salto = 2·R·(90° - beta - i)
 */
export function hopGeometry(elevDeg: number, hVirtualKm: number) {
  const R = R_EARTH_KM;
  const beta = elevDeg * DEG;
  const arg = Math.min(1, Math.max(-1, (R * Math.cos(beta)) / (R + hVirtualKm)));
  const i = Math.asin(arg); // incidencia desde la vertical en la reflexión
  let halfCentral = Math.PI / 2 - beta - i; // radianes (>= 0)
  if (halfCentral < 0) halfCentral = 0;
  const hopKm = 2 * R * halfCentral;
  return { hopKm, apexKm: hVirtualKm, incidenceDeg: i * RAD };
}

/** Inversa: dado el salto deseado y altura virtual, hallar elevación (bisección).
 *  El salto DECRECE con la elevación: plano -> tangente ~3900 km, vertical -> ~0. */
export function elevationForHop(targetKm: number, hVirtualKm: number): number | null {
  let lo = 1,
    hi = 88;
  const f = (e: number) => hopGeometry(e, hVirtualKm).hopKm - targetKm;
  if (f(lo) < 0) return lo; // inalcanzable incluso tangente -> usar mínima
  if (f(hi) > 0) return hi; // objetivo diminuto -> casi vertical
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; // salto aún largo -> más vertical
    else hi = mid; // salto corto -> más plano
  }
  return (lo + hi) / 2;
}

/** Número óptimo de saltos para una distancia total (apunta a ~3000 km/salto F2) */
export function hopCountForDistance(totalKm: number, _hVirtualKm: number): number {
  let best = 1;
  let bestErr = Infinity;
  for (let n = 1; n <= 6; n++) {
    const per = totalKm / n;
    if (per > 4000) continue;
    const err = Math.abs(per - 3000);
    if (err < bestErr) {
      bestErr = err;
      best = n;
    }
  }
  return best;
}

/** IDW sobre esfera con fondo de mediana (patrón del C++ con corrección gran-círculo) */
export function idwInterpolate(
  stations: { lat: number; lon: number; value: number }[],
  latDeg: number,
  lonDeg: number,
  radiusDeg = 50,
  bgWeight = 0.004
): number | null {
  const target = { lat: latDeg, lon: lonDeg };
  const values: number[] = stations.map((s) => s.value);
  const bg = median(values);
  let wSum = 0;
  let acc = 0;
  const wBg = bgWeight;
  for (const s of stations) {
    const d = greatCircleDeg(target, s);
    if (d > radiusDeg) continue;
    const w = 1 / (d * d + 0.5);
    acc += w * s.value;
    wSum += w;
  }
  if (wSum === 0) return bg;
  acc += wBg * bg;
  wSum += wBg;
  return acc / wSum;
}

export function greatCircleDeg(a: LatLon, b: LatLon): number {
  return (greatCircleKm(a, b) / R_EARTH_KM) * RAD;
}

export function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Coordenada geomagnética (dipolo): latitud magnética aproximada */
export function geoToMagLat(latDeg: number, lonDeg: number): number {
  const poleLat = 80.8, poleLon = -72.7;
  const d = greatCircleDeg({ lat: latDeg, lon: lonDeg }, { lat: poleLat, lon: poleLon });
  return 90 - d;
}
