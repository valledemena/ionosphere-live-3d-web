/**
 * Sombra del planeta sobre el volumen W-3 (spec del veredicto 158, sec.5.1):
 * espejo puro del test rayo-esfera del shader (drop 133,
 * src/Utils/VolumeShadow.h). Misma matematica: si el rayo desde la muestra
 * P hacia el sol cruza la esfera interior (radio innerR), la muestra esta
 * en sombra dura. Guarda 1e-4 contra tangencias numericas (frontera = luz).
 * Puro: sin DOM, sin three. El dimming cosChi se conserva y se combina
 * multiplicativamente en el volumen (cuando exista el raymarch web).
 */
export const SHADOW_GUARD = 1e-4; // frontera = luz, como el gate 126

/** true = en sombra (emision extinguida). L debe estar normalizada. */
export function shadowed(
  px: number,
  py: number,
  pz: number,
  lx: number,
  ly: number,
  lz: number,
  innerR: number
): boolean {
  const b = px * lx + py * ly + pz * lz;
  const c = px * px + py * py + pz * pz - innerR * innerR;
  const disc = b * b - c;
  if (disc < 0) return false;
  return -b - Math.sqrt(disc) > SHADOW_GUARD;
}
