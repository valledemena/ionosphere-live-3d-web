/**
 * March CPU W-3 (spec 181 P1): espejo puro del loop de volFragSrc
 * (src/Ionosphere/VolumeRenderer.cpp:48-141). Misma matematica: entrada/
 * salida por raySphere, jitter IGN del punto de entrada, sombra dura
 * multiplicativa, decodificacion geo motor (lon = pi - atan2, t sur-primero),
 * muestreo via sampleVolume con puente z por centros de texel (texelAltKm:
 * gz = altNorm*A - 0.5, n1-182), colormap via sampleColormap, iso-bandas 10.5/11/11.5, acumulacion
 * front-to-back con early-outs 0.98/0.001. Reutiliza los espejos ya
 * certificados (shadowed, entryOffset, sampleVolume, sampleColormap).
 * Sin GL, sin three, sin DOM. NO cableado a escena en este drop (sin VLM:
 * no altera pixeles -- P1-180 lo exige solo si altera).
 *
 * P3-182 (seam de lon, ruling con opcion): el wrap x se HEREDA de
 * sampleVolume (certificado para SU oraculo); el sampler GL es
 * CLAMP_TO_EDGE (sonda 182: franja media celda en +-180, solo modo
 * densidad). Adaptacion heredada declarada; no se toca sampleVolume.
 */

import { shadowed } from "./volumeShadow";
import { entryOffset } from "./volumeJitter";
import { sampleVolume, volumeAltKm, type DensityVolume } from "./densityVolume";
import { sampleColormap, type ColormapName } from "./colormaps";

// Defaults del oraculo (VolumeRenderer.h + render(): steps_=64,
// opacityScale_=1.0, isoOn_=false, u_isoWidth 0.02, early-outs del frag).
export const MARCH_STEPS = 64;
export const MARCH_OPACITY_SCALE = 1;
export const MARCH_ISO_WIDTH = 0.02;
export const MARCH_EARLY_ALPHA = 0.98;
export const MARCH_MIN_ALPHA = 0.001;
// Iso-bandas logNe 10.5/11/11.5 en normalizado (frag: 0.556/0.667/0.778).
export const MARCH_ISO = [0.556, 0.667, 0.778] as const;
// Capas fijas modo 1 (frag: D=naranja, E=verde, F1=amarillo, F2=cian).
export const MARCH_LAYER_COLORS = [
  [1.0, 0.55, 0.1],
  [0.2, 0.85, 0.3],
  [1.0, 0.9, 0.2],
  [0.2, 0.8, 1.0],
] as const;

export type V3 = [number, number, number];

export interface MarchOpts {
  innerR: number;
  outerR: number;
  /** Direccion solar UNITARIA (marco del motor, como u_sunDir). */
  sunDir: V3;
  steps?: number; // clamp 16..256 como setStepCount
  opacityScale?: number;
  isoOn?: boolean;
  isoWidth?: number;
  /** 0 = densidad (colormap), 1 = capas fijas. */
  colorMode?: number;
  cmap?: ColormapName;
  /** Pixel para el jitter IGN (gl_FragCoord.xy). */
  px?: number;
  py?: number;
}

export interface MarchHit {
  color: V3;
  alpha: number;
}

/** raySphere completo (t0 = near, t1 = far). Misma matematica que el frag. */
export function raySphereT(
  rox: number, roy: number, roz: number,
  rdx: number, rdy: number, rdz: number,
  r: number
): { hit: boolean; t0: number; t1: number } {
  const b = rox * rdx + roy * rdy + roz * rdz;
  const c = rox * rox + roy * roy + roz * roz - r * r;
  const disc = b * b - c;
  if (disc < 0) return { hit: false, t0: 0, t1: 0 };
  const s = Math.sqrt(disc);
  return { hit: true, t0: -b - s, t1: -b + s };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * Altura TRUE del nivel muestreado a fraccion altNorm (n1-182, fix 183):
 * el sampler GL interpola en CENTROS DE TEXEL gz = altNorm*A - 0.5 con
 * clamp de borde (sonda WebGL2: 16/16 lecturas exactas), NO en niveles
 * k/(A-1) del camino CPU. Los clamps replican el edge: altNorm 0/1 dan
 * el texel 0/A-1 puros. Pura.
 */
export function texelAltKm(altNorm: number, A: number, altMinKm: number, altMaxKm: number): number {
  const L = altNorm * A - 0.5;
  const la0 = Math.min(A - 1, Math.max(0, Math.floor(L)));
  const la1 = Math.min(A - 1, la0 + 1);
  const fa = Math.min(1, Math.max(0, L - la0));
  const h0 = volumeAltKm(la0, A, altMinKm, altMaxKm);
  const h1 = volumeAltKm(la1, A, altMinKm, altMaxKm);
  return h0 * (1 - fa) + h1 * fa;
}

/**
 * Marcha un rayo por el volumen. null = discard del shader (sin
 * interseccion, ocluido o alfa <= 0.001). Puro y determinista.
 */
export function marchRay(
  vol: DensityVolume,
  ro: V3,
  rd: V3,
  o: MarchOpts
): MarchHit | null {
  if (!vol.valid || vol.data.length === 0) return null;
  const steps = Math.min(256, Math.max(16, o.steps ?? MARCH_STEPS));
  const opacityScale = o.opacityScale ?? MARCH_OPACITY_SCALE;
  const isoWidth = o.isoWidth ?? MARCH_ISO_WIDTH;
  const colorMode = o.colorMode ?? 0;
  const cmap = o.cmap ?? "viridis";
  const outer = raySphereT(ro[0], ro[1], ro[2], rd[0], rd[1], rd[2], o.outerR);
  if (!outer.hit) return null;
  let tEnter = Math.max(outer.t0, 0);
  let tExit = outer.t1;
  const inner = raySphereT(ro[0], ro[1], ro[2], rd[0], rd[1], rd[2], o.innerR);
  if (inner.hit && inner.t0 > tEnter) {
    tExit = Math.min(tExit, inner.t0); // no ver a traves del planeta
  }
  if (tExit <= tEnter) return null;
  if (colorMode === 1) {
    // Oclusion terrestre analitica (radio 1.0), modo categorico.
    const e = raySphereT(ro[0], ro[1], ro[2], rd[0], rd[1], rd[2], 1);
    if (e.hit && e.t0 > tEnter) {
      tExit = Math.min(tExit, e.t0);
    }
    if (tExit <= tEnter) return null;
  }
  const dt = (tExit - tEnter) / steps;
  const jit = entryOffset(o.px ?? 0, o.py ?? 0);
  const tEnterJ = tEnter + dt * jit;
  let accumR = 0, accumG = 0, accumB = 0, accumAlpha = 0;
  const W = vol.lonRes, H = vol.latRes, A = vol.altRes;
  for (let i = 0; i < 256; i++) {
    if (i >= steps) break;
    const t = tEnterJ + dt * (i + 0.5);
    if (t >= tExit) break;
    const px = ro[0] + rd[0] * t;
    const py = ro[1] + rd[1] * t;
    const pz = ro[2] + rd[2] * t;
    const sunShadow = shadowed(px, py, pz, o.sunDir[0], o.sunDir[1], o.sunDir[2], o.innerR) ? 0 : 1;
    const r = Math.sqrt(px * px + py * py + pz * pz);
    const altNorm = Math.min(1, Math.max(0, (r - o.innerR) / (o.outerR - o.innerR)));
    const n = r > 0 ? 1 / r : 0;
    const nx = px * n, ny = py * n, nz = pz * n;
    const lat = Math.asin(Math.min(1, Math.max(-1, ny)));
    // t=0 es el SUR; lon = pi - atan2 (convencion del motor, NO ingenua).
    let lon = Math.PI - Math.atan2(nz, nx);
    if (lon > Math.PI) lon -= 2 * Math.PI;
    if (lon < -Math.PI) lon += 2 * Math.PI;
    const uvx = lon / (2 * Math.PI) + 0.5;
    const uvy = lat / Math.PI + 0.5;
    const latDeg = (lat * 180) / Math.PI;
    let lonDeg = (lon * 180) / Math.PI;
    if (lonDeg < -180) lonDeg += 360;
    if (lonDeg > 180) lonDeg -= 360;
    // Altura TRUE por convencion GL de centros (texelAltKm, n1-182).
    const altKm = texelAltKm(altNorm, A, vol.altMinKm, vol.altMaxKm);
    // Muestreo por el camino certificado (equivale al LINEAR de textura).
    const d = sampleVolume(vol, latDeg, lonDeg, altKm);
    let cr: number, cg: number, cb: number;
    if (colorMode === 1) {
      // ID exacto por vecino mas cercano (el LINEAR corromperia fronteras).
      const ix = Math.min(W - 1, Math.max(0, Math.floor(uvx * W)));
      const iy = Math.min(H - 1, Math.max(0, Math.floor(uvy * H)));
      const ia = Math.min(A - 1, Math.max(0, Math.floor(altNorm * A)));
      const wgt = vol.layer.length === vol.data.length ? vol.layer[(ia * H + iy) * W + ix] : 3;
      const c = MARCH_LAYER_COLORS[wgt < 0 ? 0 : wgt > 3 ? 3 : wgt];
      cr = c[0];
      cg = c[1];
      cb = c[2];
    } else {
      const s = sampleColormap(cmap, d);
      cr = s[0];
      cg = s[1];
      cb = s[2];
    }
    cr *= sunShadow;
    cg *= sunShadow;
    cb *= sunShadow;
    let a = Math.min(1, Math.max(0, d * d * opacityScale * dt * 40)) * sunShadow;
    if (o.isoOn) {
      const m = Math.min(Math.abs(d - MARCH_ISO[0]), Math.abs(d - MARCH_ISO[1]), Math.abs(d - MARCH_ISO[2]));
      let tt = m / isoWidth;
      tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
      const band = 1 - tt * tt * (3 - 2 * tt);
      cr = cr + (1 - cr) * band * 0.55;
      cg = cg + (1 - cg) * band * 0.55;
      cb = cb + (1 - cb) * band * 0.55;
      const am = band * 0.35;
      a = Math.max(a, Math.min(am, opacityScale));
    }
    accumR += (1 - accumAlpha) * a * cr;
    accumG += (1 - accumAlpha) * a * cg;
    accumB += (1 - accumAlpha) * a * cb;
    accumAlpha += (1 - accumAlpha) * a;
    if (accumAlpha > MARCH_EARLY_ALPHA) break;
  }
  if (accumAlpha <= MARCH_MIN_ALPHA) return null;
  return { color: [accumR, accumG, accumB], alpha: accumAlpha };
}
