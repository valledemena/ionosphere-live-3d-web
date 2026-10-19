/**
 * Ref-shells E/F1/F2 + iso-bands + labels W-4 (clase F1): espejo de
 * RefShells.h/.cpp, VolumeRenderer iso (u_isoOn/u_isoWidth) y App.cpp
 * :4230-4236/:5470-5525. Puro, sin GL, sin red. TU: refshells.test.ts.
 */

// Colores del oraculo (RefShells.cpp:71-78).
export const REF_COLORS = {
  e: [0.1, 0.45, 0.2],
  f1: [0.5, 0.42, 0.1],
  f2: [0.5, 0.22, 0.07],
} as const;

// Iso-bands logNe (VolumeRenderer.cpp:128-129, ancho :274).
export const ISO_LEVELS = [10.5, 11, 11.5];
export const ISO_WIDTH = 0.02;

export interface RefAltitudes {
  e: number;
  f1: number;
  f2: number;
}

/** Alturas E110 / F1-max(150,0.8mh) / F2-mh (App.cpp:2487).
 *  null sin mediana (guard <0.5 km: RefShells.cpp:117-121). */
export function refAltitudes(hmF2s: number[]): RefAltitudes | null {
  const vs = hmF2s.filter((v) => v > 0).sort((a, b) => a - b);
  if (!vs.length) return null;
  const mh = vs[vs.length >> 1];
  if (mh < 0.5) return null;
  return { e: 110, f1: Math.max(150, 0.8 * mh), f2: mh };
}

/** Clave de rebuild (alturas + exageración). */
export function refKey(a: RefAltitudes, exaggeration: number): string {
  return `${a.e}|${a.f1}|${a.f2}|${exaggeration}`;
}

/** Cull de etiqueta (App.cpp:5471-5479): dorso o fuera de NDC. */
export function labelCulled(facing: number, ndcX: number, ndcY: number): boolean {
  return facing < 0.15 || Math.abs(ndcX) > 1.1 || Math.abs(ndcY) > 1.1;
}

/** Longitud del meridiano de medianoche desde el vector solar unitario.
 *  Replica vec3ToLatLon(-dir): phi=atan2(-sz, sx), lon=phi-180. */
export function midnightLon(sunX: number, _sunY: number, sunZ: number): number {
  const phi = Math.atan2(-sunZ, sunX);
  let lon = (phi * 180) / Math.PI - 180;
  if (lon < -180) lon += 360;
  if (lon > 180) lon -= 360;
  return lon;
}
