/**
 * Blue-noise jitter del punto de entrada W-3 (spec 158 sec.5.2 / 160-P1):
 * espejo puro del offset IGN del shader (drop 135,
 * src/Utils/VolumeJitter.h, Jimenez 2014). Offset en [0,1) SOLO del punto
 * de entrada del rayo. SIN componente temporal (el motor no tiene TAA;
 * acumulador temporal PROHIBIDO por la spec): mismos coords -> mismo
 * offset siempre. Cada operacion se redondea a f32 via Math.fround para
 * ser bit-exacta con el float del C++ (pines medidos del TU 135).
 * Puro: sin DOM, sin three.
 */
const KX = 0.06711056;
const KY = 0.00583715;
const KG = 52.9829189;

/** Offset en [0,1) para el pixel (x, y). IGN (Jimenez 2014). */
export function entryOffset(x: number, y: number): number {
  const d = Math.fround(Math.fround(x * Math.fround(KX)) + Math.fround(y * Math.fround(KY)));
  const f = Math.fround(d - Math.floor(d));
  const g = Math.fround(Math.fround(KG) * f);
  return Math.fround(g - Math.floor(g));
}
