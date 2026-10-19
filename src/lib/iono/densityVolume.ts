/**
 * Volumen de densidad electronica W-3 (spec 158 sec.5.4 / 162-P1): espejo
 * puro de la parte NO-GL de src/Ionosphere/DensityVolume.h (drop C++ con
 * LayerProfile). Layout, alturas, direccion del motor, dia/noche, picos
 * derivados (pin 158 s5.4: shells DERIVADAS del volumen, no parametros
 * sueltos), TEC y muestreo. Puro: sin DOM, sin three, sin GL.
 * NO espejado (viaja con el wiring del volumen): RefShells es clase GL
 * pura (VAO/VBO/shader): nada que espejar; la web ya tiene anillos de
 * referencia propios (buildRefRings). buildDensityVolume vive en
 * layerProfile.ts desde el drop 167 (P5-168: cabecera actualizada).
 */

// Layout del oraculo: data[(altIdx*latRes + latIdx)*lonRes + lonIdx],
// lonIdx 0 = lon -180, latIdx 0 = sur (lat -90), altIdx 0 = altMinKm.
// Se guarda log10(Ne) normalizado 0..1 (rango log10 [8, 12.5]).
export const VOL_LON_RES = 72;
export const VOL_LAT_RES = 72;
export const VOL_ALT_RES = 48;
export const VOL_ALT_MIN_KM = 60;
export const VOL_ALT_MAX_KM = 500;
export const VOL_LOG_MIN = 8.0;
export const VOL_LOG_RANGE = 4.5; // 12.5 - 8.0
export const VOL_PEAK_FLOOR = 8.5; // picos bajo logNe 8.5 -> hueco (hm = 0)

export interface DensityVolume {
  lonRes: number;
  latRes: number;
  altRes: number;
  altMinKm: number;
  altMaxKm: number;
  data: number[]; // log10(Ne) normalizado 0..1, layout del oraculo
  layer: number[]; // rama ganadora por muestra (0=D,1=E,2=F1,3=F2)
  valid: boolean;
  timestamp: number;
}

export interface GridData {
  width: number;
  height: number;
  values: number[];
  valid: boolean;
  timestamp: number;
}

/** Indice lineal del layout data[(a*H+y)*W+x]. */
export function volumeIndex(x: number, y: number, a: number, w: number, h: number): number {
  return (a * h + y) * w + x;
}

// h_i = altMin + (altMax-altMin) * (i/(n-1))^1.5
export function volumeAltKm(i: number, n: number, altMinKm: number, altMaxKm: number): number {
  const f = n <= 1 ? 0 : i / (n - 1);
  return altMinKm + (altMaxKm - altMinKm) * Math.pow(f, 1.5);
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Vista minima de perfil para applyDayNight (NmE/NmF1 + flags E/F1). */
export interface DayNightProfile {
  NmE: number;
  NmF1: number;
  hasE: boolean;
  hasF1: boolean;
}

/**
 * Atenua E/F1 de noche sobre una rejilla de perfiles (las sondas no miden
 * foE/foF1 nocturnos). F2 y D los gestiona el evaluador. sunDir en el marco
 * del motor. Port de applyDayNight: smoothstep(-0.05, 0.25, cosChi) con la
 * convencion angular del motor (theta = pi - lon); e <= 0 apaga los flags.
 */
export function applyDayNight(
  profiles: DayNightProfile[],
  lonRes: number,
  latRes: number,
  sunX: number,
  sunY: number,
  sunZ: number
): void {
  if (profiles.length !== lonRes * latRes) return;
  const kPi = Math.PI;
  for (let latIdx = 0; latIdx < latRes; latIdx++) {
    const latDeg = -90 + (180 * (latIdx + 0.5)) / latRes;
    const phi = ((90 - latDeg) * kPi) / 180;
    for (let lonIdx = 0; lonIdx < lonRes; lonIdx++) {
      const lonDeg = -180 + (360 * (lonIdx + 0.5)) / lonRes;
      const theta = kPi - (lonDeg * kPi) / 180; // convencion del motor
      const cx = Math.sin(phi) * Math.cos(theta);
      const cy = Math.cos(phi);
      const cz = Math.sin(phi) * Math.sin(theta);
      const e = smoothstep(-0.05, 0.25, cx * sunX + cy * sunY + cz * sunZ);
      const p = profiles[latIdx * lonRes + lonIdx];
      p.NmE *= e;
      p.NmF1 *= e;
      if (e <= 0) {
        p.hasE = false;
        p.hasF1 = false;
      }
    }
  }
}

/**
 * Direccion unitaria en el marco del motor (theta = pi - lon).
 * OJO (historial de meridianos rotados 180 grados del C++): NO usar
 * radians(lon) a secas; convencion verificada de IonosondeLayer.cpp:249.
 */
export function densityDir(latDeg: number, lonDeg: number): [number, number, number] {
  const kPi = Math.PI;
  const phi = ((90 - latDeg) * kPi) / 180;
  const theta = kPi - (lonDeg * kPi) / 180;
  const sn = Math.sin(phi);
  return [sn * Math.cos(theta), Math.cos(phi), sn * Math.sin(theta)];
}

export interface PeakGrids {
  logNe: GridData; // log10(Ne) del pico (para color)
  hmKm: GridData; // altura del pico en km (refinada; hueco = 0)
}

/** Picos por columna extraidos del volumen (plan volume-derived-shells). */
export function extractPeakGrids(v: DensityVolume): PeakGrids {
  const blank = (): GridData => ({ width: 0, height: 0, values: [], valid: false, timestamp: 0 });
  const out: PeakGrids = { logNe: blank(), hmKm: blank() };
  out.logNe.width = v.lonRes;
  out.logNe.height = v.latRes;
  out.hmKm.width = v.lonRes;
  out.hmKm.height = v.latRes;
  out.logNe.values = new Array(v.lonRes * v.latRes).fill(0);
  out.hmKm.values = new Array(v.lonRes * v.latRes).fill(0);
  if (!v.valid || v.data.length === 0 || v.lonRes < 1 || v.latRes < 1 || v.altRes < 3) return out;
  const W = v.lonRes;
  const H = v.latRes;
  const A = v.altRes;
  const at = (x: number, y: number, a: number): number => v.data[(a * H + y) * W + x];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let bi = 0;
      for (let a = 1; a < A; a++) if (at(x, y, a) > at(x, y, bi)) bi = a;
      let peak = at(x, y, bi);
      let hm = volumeAltKm(bi, A, v.altMinKm, v.altMaxKm);
      if (bi > 0 && bi + 1 < A) {
        // Refinamiento sub-muestra: parabola por los 3 puntos con sus
        // alturas REALES (espaciado ^1.5 no uniforme). Vertice de Lagrange.
        const x0 = volumeAltKm(bi - 1, A, v.altMinKm, v.altMaxKm);
        const x1 = hm;
        const x2 = volumeAltKm(bi + 1, A, v.altMinKm, v.altMaxKm);
        const y0 = at(x, y, bi - 1);
        const y1 = peak;
        const y2 = at(x, y, bi + 1);
        const den = x0 * (y1 - y2) + x1 * (y2 - y0) + x2 * (y0 - y1);
        if (Math.abs(den) > 1e-9) {
          let xs = (0.5 * (x0 * x0 * (y1 - y2) + x1 * x1 * (y2 - y0) + x2 * x2 * (y0 - y1))) / den;
          if (xs < x0) xs = x0;
          if (xs > x2) xs = x2;
          // Valor en el vertice: t en [-1,1] sobre el tramo local.
          let t = (xs - x1) / (0.5 * (x2 - x0) + 1e-9);
          if (t < -1) t = -1;
          if (t > 1) t = 1;
          hm = xs;
          peak = y1 - 0.25 * (y0 - y2) * t;
        }
      }
      const logNe = VOL_LOG_MIN + VOL_LOG_RANGE * peak; // des-normalizar
      out.logNe.values[y * W + x] = logNe;
      out.hmKm.values[y * W + x] = logNe < VOL_PEAK_FLOOR ? 0 : hm;
    }
  }
  out.logNe.valid = out.hmKm.valid = true;
  out.logNe.timestamp = out.hmKm.timestamp = v.timestamp;
  return out;
}

// TEC[TECU] = integral trapezoidal de Ne[m^-3] dh[m] / 1e16, con el Ah real
// por tramo (alturas en ^1.5, NO uniformes).
export function integrateTEC(v: DensityVolume, latIdx: number, lonIdx: number): number {
  if (!v.valid || v.data.length === 0) return 0;
  const W = v.lonRes;
  const H = v.latRes;
  const A = v.altRes;
  if (latIdx < 0 || latIdx >= H || lonIdx < 0 || lonIdx >= W || A < 2) return 0;
  let tec = 0;
  for (let a = 0; a + 1 < A; a++) {
    const n0 = v.data[(a * H + latIdx) * W + lonIdx];
    const n1 = v.data[((a + 1) * H + latIdx) * W + lonIdx];
    const Ne0 = Math.pow(10, VOL_LOG_MIN + VOL_LOG_RANGE * n0);
    const Ne1 = Math.pow(10, VOL_LOG_MIN + VOL_LOG_RANGE * n1);
    const dh =
      (volumeAltKm(a + 1, A, v.altMinKm, v.altMaxKm) - volumeAltKm(a, A, v.altMinKm, v.altMaxKm)) * 1000;
    tec += 0.5 * (Ne0 + Ne1) * dh;
  }
  return tec / 1e16;
}

/** Muestreo trilineal con wrap en lon y clamp en lat/alt. */
export function sampleVolume(v: DensityVolume, latDeg: number, lonDeg: number, altKm: number): number {
  if (!v.valid || v.data.length === 0 || v.lonRes < 2 || v.latRes < 2 || v.altRes < 2) return 0;
  const W = v.lonRes;
  const H = v.latRes;
  const A = v.altRes;
  const gx = ((lonDeg + 180) / 360) * W - 0.5;
  const gy = ((latDeg + 90) / 180) * H - 0.5;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  let a0 = 0;
  while (a0 + 1 < A && volumeAltKm(a0 + 1, A, v.altMinKm, v.altMaxKm) <= altKm) a0++;
  const a1 = a0 + 1 < A ? a0 + 1 : a0;
  const h0 = volumeAltKm(a0, A, v.altMinKm, v.altMaxKm);
  const h1 = volumeAltKm(a1, A, v.altMinKm, v.altMaxKm);
  let fa = h1 > h0 ? (altKm - h0) / (h1 - h0) : 0;
  fa = Math.min(1, Math.max(0, fa));
  const at = (x: number, y: number, a: number): number => {
    const xx = ((x % W) + W) % W;
    const yy = y < 0 ? 0 : y >= H ? H - 1 : y;
    return v.data[(a * H + yy) * W + xx];
  };
  const lo =
    at(x0, y0, a0) * (1 - fx) * (1 - fy) +
    at(x0 + 1, y0, a0) * fx * (1 - fy) +
    at(x0, y0 + 1, a0) * (1 - fx) * fy +
    at(x0 + 1, y0 + 1, a0) * fx * fy;
  const hi =
    at(x0, y0, a1) * (1 - fx) * (1 - fy) +
    at(x0 + 1, y0, a1) * fx * (1 - fy) +
    at(x0, y0 + 1, a1) * (1 - fx) * fy +
    at(x0 + 1, y0 + 1, a1) * fx * fy;
  return lo * (1 - fa) + hi * fa;
}

// ---------------------------------------------------------------------------
// W-4 F2: parámetros de render del volumen (espejo VolumeRenderer.h:31-37
// + App.cpp:4219-4227: Combo Density/Chapman + escala de opacidad).
// Colores ganadores D/E/F1/F2 byte-iguales a la rama Chapman de VOL_FRAG
// (pin anti-deriva: el shader los lleva hardcodeados). TU: densityVolume.
// ---------------------------------------------------------------------------

/** Ganadores D/E/F1/F2 (mirror VOL_FRAG u_colorMode==1). */
export const CHAPMAN_WINNER_COLORS: readonly (readonly [number, number, number])[] = [
  [1.0, 0.55, 0.1],
  [0.2, 0.85, 0.3],
  [1.0, 0.9, 0.2],
  [0.2, 0.8, 1.0],
] as const;

/** density->0, chapman->1 (u_colorMode). */
export function volumeModeIndex(mode: "density" | "chapman"): 0 | 1 {
  return mode === "chapman" ? 1 : 0;
}

/** Clamp [0,3] (setOpacityScale, VolumeRenderer.h:37). */
export function volumeOpacityClamp(v: number): number {
  if (!(v > 0)) return 0;
  if (v > 3) return 3;
  return v;
}
