/**
 * W-4 F2b #10 (ruling 320; micro-drop 323 §6.1 del veredicto 322): anillo
 * West Ford 1963 DECLARADO.
 *
 * Reconstruccion ilustrativa (no datos vivos, no propagacion): banda de
 * particulas en UN plano orbital — nodo fijo declarado (valor ilustrativo;
 * no hay dato historico de RAAN) e inclinacion 87.4 grados (SAGE 2025;
 * elipticidad leve declarada), con jitter ±0.6 grados en ambos (espesor
 * declarado de la banda) y altitud 3.600x3.680 km — ~4,8e8 dipolos de
 * 1,78 cm (mayo 1963) dispersados a lo largo de la orbita. Se dibujan
 * RING_PARTICLES muestras deterministas (LCG con semilla fija): la nube es
 * reproducible byte a byte entre builds. Estatica (sin rotacion simulada):
 * es una ilustracion del plano, no una orbita fingida. Etiqueta obligatoria
 * RING_LABEL.
 */
import { R_EARTH_KM } from "../geo";

export const RING_ALT_KM_MIN = 3600;
export const RING_ALT_KM_MAX = 3680;
export const RING_INC_DEG = 87.4;
/** Nodo fijo declarado de la banda (grados): la banda vive EN ESTE plano
 *  (± jitter de espesor). Valor ilustrativo: no hay dato historico de RAAN. */
export const RING_NODE_DEG = 0;
/** Espesor declarado: jitter ± (grados) en nodo e inclinacion. */
export const RING_JITTER_DEG = 0.6;
/** Dipolos reales del cinturon (declarado; nunca se renderizan 1:1). */
export const RING_DIPOLES = 4.8e8;
/** Dipolo individual: dimension fisica declarada (m). */
export const RING_DIPOLE_LENGTH_M = 0.0178;
/** Muestras de particula dibujadas. */
export const RING_PARTICLES = 4096;

/** Texto EXACTO de la etiqueta (ruling 320; dos sitios: panel + leyenda). */
export const RING_LABEL = "West Ford 1963 — reconstrucción declarada (sin datos vivos)";

/** LCG determinista (mulberry32); semilla fija = nube reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Posiciones de escena (unidades R_E) de la banda: para cada muestra, el
 * MISMO plano orbital (nodo fijo RING_NODE_DEG) con jitter ±RING_JITTER_DEG
 * en nodo e inclinacion (espesor declarado), inclinacion RING_INC_DEG y
 * radio 1 + alt/6371 con alt en [3600, 3680] km.
 */
export function buildRing1963(count: number = RING_PARTICLES): Float32Array {
  const rnd = mulberry32(19630509);
  const out = new Float32Array(count * 3);
  const deg = Math.PI / 180;
  for (let i = 0; i < count; i++) {
    const node = (RING_NODE_DEG + (rnd() - 0.5) * 2 * RING_JITTER_DEG) * deg;
    const inc = (RING_INC_DEG + (rnd() - 0.5) * 2 * RING_JITTER_DEG) * deg;
    const altKm = RING_ALT_KM_MIN + rnd() * (RING_ALT_KM_MAX - RING_ALT_KM_MIN);
    const r = 1 + altKm / R_EARTH_KM;
    const u = rnd() * Math.PI * 2;
    // Normal del plano orbital (y = norte): inclinacion desde el eje polar.
    const nx = Math.sin(inc) * Math.cos(node);
    const ny = Math.cos(inc);
    const nz = Math.sin(inc) * Math.sin(node);
    // Base ortonormal del plano: e1 = y x n / |..|, e2 = n x e1.
    let e1x = nz;
    let e1y = 0;
    let e1z = -nx;
    const e1n = Math.hypot(e1x, e1y, e1z) || 1;
    e1x /= e1n;
    e1y /= e1n;
    e1z /= e1n;
    const e2x = ny * e1z - nz * e1y;
    const e2y = nz * e1x - nx * e1z;
    const e2z = nx * e1y - ny * e1x;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    out[i * 3] = r * (cu * e1x + su * e2x);
    out[i * 3 + 1] = r * (cu * e1y + su * e2y);
    out[i * 3 + 2] = r * (cu * e1z + su * e2z);
  }
  return out;
}
