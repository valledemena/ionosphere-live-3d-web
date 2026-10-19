/**
 * Cortina slice QTH-DX W-4 (clase B1): espejo de SliceLayer + App.cpp:3131-3195.
 *
 * Rejilla SEG x LVL (64x20) sobre el circulo maximo A->B (slerp con fallback
 * lerp), alturas 60-700 km con espaciado ^1.5 (volumeAltKm, como el volumen),
 * muestreo trilinear via sampleVolume (0..1 = logNe normalizado) y horneado
 * CPU a RGBA con la paleta viridis + alfa d*1.2 (SliceLayer.cpp:109-119).
 * Pico: peakLog = 8+4.5*peak (App.cpp:3195) para el readout "A->B pk X.X".
 * Puera, sin GL, sin red. TU: slice.test.ts.
 */
import { sampleVolume, volumeAltKm, type DensityVolume } from "./densityVolume";
import { buildPalette } from "./colormaps";
import { latLonToVec3, vec3ToLatLon } from "./geo";

export const SLICE_SEG = 64;
export const SLICE_LVL = 20;
export const SLICE_ALT_MIN = 60;
export const SLICE_ALT_MAX = 700;

export type SliceSrc = "link" | "manual" | "fixed";

export interface SliceEndpoints {
  latA: number;
  lonA: number;
  latB: number;
  lonB: number;
}

/** Resuelve endpoints por modo. null = no-op (sin A, sin B o A==B). */
export function resolveSliceEndpoints(
  src: SliceSrc,
  linkA: { lat: number; lon: number } | null,
  linkB: { lat: number; lon: number } | null,
  manA: { lat: number; lon: number },
  manB: { lat: number; lon: number },
): SliceEndpoints | null {
  let a: { lat: number; lon: number } | null = null;
  let b: { lat: number; lon: number } | null = null;
  if (src === "link") {
    a = linkA;
    b = linkB;
  } else if (src === "manual") {
    a = manA;
    b = manB;
  } else {
    // Fixed+-2°: ancla en la coordenada A editable (como App.cpp
    // sliceLatA/LonA; sin necesidad de enlace). Veredicto 202 o2.
    a = { lat: manA.lat, lon: manA.lon - 2 };
    b = { lat: manA.lat, lon: manA.lon + 2 };
  }
  if (!a || !b) return null;
  if (a.lat === b.lat && a.lon === b.lon) return null;
  return { latA: a.lat, lonA: a.lon, latB: b.lat, lonB: b.lon };
}

function slerpLatLon(
  latA: number, lonA: number, latB: number, lonB: number, t: number,
): { lat: number; lon: number } {
  // Vectores unitarios geograficos (convencion geo: latLonToVec3).
  const [ax, ay, az] = latLonToVec3(latA, lonA, 1);
  const [bx, by, bz] = latLonToVec3(latB, lonB, 1);
  let dot = ax * bx + ay * by + az * bz;
  dot = Math.min(1, Math.max(-1, dot));
  if (dot > 0.999999) {
    return { lat: latA + (latB - latA) * t, lon: lonA + (lonB - lonA) * t };
  }
  const omega = Math.acos(dot);
  // o4(a): guard antipodal del espejo (omega < pi-1e-4 -> fallback lerp;
  // sin(omega)~1e-16 dividiría por ~0).
  if (omega > Math.PI - 1e-4) {
    return { lat: latA + (latB - latA) * t, lon: lonA + (lonB - lonA) * t };
  }
  const s = Math.sin(omega);
  const ka = Math.sin((1 - t) * omega) / s;
  const kb = Math.sin(t * omega) / s;
  const x = ka * ax + kb * bx;
  const y = ka * ay + kb * by;
  const z = ka * az + kb * bz;
  // Inversa exacta de latLonToVec3 (misma convencion que el resto).
  return vec3ToLatLon(x, y, z);
}

export interface SliceGrid {
  /** RGBA por vertice, fila-major LVL x SEG (v=0 abajo). */
  rgba: Uint8Array;
  /** Pico logNe (8+4.5*peak) para el readout. */
  peakLog: number;
  /** Clave de rebuild (endpoints + stamp del volumen). */
  key: string;
}

/** Muestrea la cortina sobre el volumen. null si endpoints no-op o !vol.valid. */
export function buildSliceGrid(
  vol: DensityVolume,
  ep: SliceEndpoints | null,
  volStamp: number,
): SliceGrid | null {
  if (!ep || !vol.valid) return null;
  const pal = buildPalette("viridis", 256);
  const rgba = new Uint8Array(SLICE_SEG * SLICE_LVL * 4);
  let peak = 0;
  for (let j = 0; j < SLICE_LVL; j++) {
    const alt = volumeAltKm(j, SLICE_LVL, SLICE_ALT_MIN, SLICE_ALT_MAX);
    for (let i = 0; i < SLICE_SEG; i++) {
      const t = SLICE_SEG <= 1 ? 0 : i / (SLICE_SEG - 1);
      const { lat, lon } = slerpLatLon(ep.latA, ep.lonA, ep.latB, ep.lonB, t);
      const d = Math.min(1, Math.max(0, sampleVolume(vol, lat, lon, alt)));
      if (d > peak) peak = d;
      // o4(d): truncado como el (unsigned char) del oraculo (no round).
      const pi = Math.min(255, Math.max(0, Math.trunc(d * 255)));
      const o = (j * SLICE_SEG + i) * 4;
      // buildPalette devuelve 0..1 (stops float): a byte 0..255, truncado.
      rgba[o] = Math.min(255, Math.max(0, Math.trunc(pal[pi * 3] * 255)));
      rgba[o + 1] = Math.min(255, Math.max(0, Math.trunc(pal[pi * 3 + 1] * 255)));
      rgba[o + 2] = Math.min(255, Math.max(0, Math.trunc(pal[pi * 3 + 2] * 255)));
      rgba[o + 3] = Math.min(255, Math.trunc(d * 1.2 * 255));
    }
  }
  const key = `${ep.latA}|${ep.lonA}|${ep.latB}|${ep.lonB}|${volStamp}`;
  return { rgba, peakLog: 8 + 4.5 * peak, key };
}

/** Posiciones de la cortina (radio exagerado como los tubos). */
export function slicePositions(
  ep: SliceEndpoints,
  exaggeration: number,
): Float32Array {
  const pos = new Float32Array(SLICE_SEG * SLICE_LVL * 3);
  for (let j = 0; j < SLICE_LVL; j++) {
    const alt = volumeAltKm(j, SLICE_LVL, SLICE_ALT_MIN, SLICE_ALT_MAX);
    const r = 1 + (alt / 6371) * exaggeration;
    for (let i = 0; i < SLICE_SEG; i++) {
      const t = SLICE_SEG <= 1 ? 0 : i / (SLICE_SEG - 1);
      const { lat, lon } = slerpLatLon(ep.latA, ep.lonA, ep.latB, ep.lonB, t);
      const [x, y, z] = latLonToVec3(lat, lon, r);
      const o = (j * SLICE_SEG + i) * 3;
      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = z;
    }
  }
  return pos;
}

/** Etiqueta: enlace "A→B", manual/fijo coordenadas "%.1f,%.0f" (o4e). */
export function sliceLabel(
  codeA: string, codeB: string, peakLog: number,
  coords: { latA: number; lonA: number; latB: number; lonB: number } | null,
): string {
  const pk = `pk ${peakLog.toFixed(1)}`;
  if (!coords) return `${codeA}\u2192${codeB} ${pk}`;
  const f = (la: number, lo: number) => `${la.toFixed(1)},${lo.toFixed(0)}`;
  return `${f(coords.latA, coords.lonA)}\u2192${f(coords.latB, coords.lonB)} ${pk}`;
}
