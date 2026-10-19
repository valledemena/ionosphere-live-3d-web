/**
 * God rays screen-space W-3 (spec 158 sec.5.3 / 162-P1): espejo puro del pase
 * (drops 143/147, src/Utils/Godrays.h). Misma matematica que godrays.frag:
 * 12 taps radiales hacia el sol en UV con correccion de aspecto, pesos
 * decay^i, mascara analitica (opcion B: solo la Tierra ocluye) y puerta CPU
 * (skip si el sol no esta en pantalla o tras el limbo). Incluye el algebra
 * lineal minima que projectSun necesita (perspective/lookAt/mat4, convenio
 * columna-mayor como glm). Puro: sin DOM, sin three, sin GL.
 */
export const NTAPS = 12;
export const DECAY = 0.9;
export const MAX_RADIUS = 0.45; // fraccion de alto de pantalla
export const FALLOFF_K = 8.0;
export const EARTH_R = 1.0;
export const GAIN = 0.12; // ganancia global (post-ACES, display)
export const SUN_R = 1.0;
export const SUN_G = 0.9;
export const SUN_B = 0.75; // sol calido
const LIMB_GUARD = 1e-4;

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
export type Vec4 = [number, number, number, number];
/** Matriz 4x4 columna-mayor (16 numeros, como glm). */
export type Mat4 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export function vec3Length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

export function vec3Normalize(v: Vec3): Vec3 {
  const l = vec3Length(v);
  return [v[0] / l, v[1] / l, v[2] / l];
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function vec3Cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** glm::perspective (fovy en radianes). */
export function mat4Perspective(fovy: number, aspect: number, near: number, far: number): Mat4 {
  const t = Math.tan(fovy / 2);
  return [
    1 / (aspect * t), 0, 0, 0,
    0, 1 / t, 0, 0,
    0, 0, -(far + near) / (far - near), -1,
    0, 0, -(2 * far * near) / (far - near), 0,
  ];
}

/** glm::lookAt. */
export function mat4LookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
  const f = vec3Normalize([center[0] - eye[0], center[1] - eye[1], center[2] - eye[2]]);
  const s = vec3Normalize(vec3Cross(f, up));
  const u = vec3Cross(s, f);
  return [
    s[0], u[0], -f[0], 0,
    s[1], u[1], -f[1], 0,
    s[2], u[2], -f[2], 0,
    -vec3Dot(s, eye), -vec3Dot(u, eye), vec3Dot(f, eye), 1,
  ];
}

/** C = A * B (columna-mayor). */
export function mat4Mul(a: Mat4, b: Mat4): Mat4 {
  const c = new Array<number>(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      c[col * 4 + row] =
        a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
    }
  }
  return c as Mat4;
}

/**
 * Inversa 4x4 por adjunta/determinante (columna-mayor). La necesita el pase
 * (u_invViewProj del oraculo: glm::inverse -- n1-178: pasar P*V sin invertir
 * rompe la mascara en ~1/3 de los taps). Pura.
 */
export function mat4Inverse(m: Mat4): Mat4 {
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3];
  const a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7];
  const a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11];
  const a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (det === 0) return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  det = 1 / det;
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * det,
    (a02 * b10 - a01 * b11 - a03 * b09) * det,
    (a31 * b05 - a32 * b04 + a33 * b03) * det,
    (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det,
    (a00 * b11 - a02 * b08 + a03 * b07) * det,
    (a32 * b02 - a30 * b05 - a33 * b01) * det,
    (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det,
    (a01 * b08 - a00 * b10 - a03 * b06) * det,
    (a30 * b04 - a31 * b02 + a33 * b00) * det,
    (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det,
    (a00 * b09 - a01 * b07 + a02 * b06) * det,
    (a31 * b01 - a30 * b03 - a32 * b00) * det,
    (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ];
}

/**
 * Desproyeccion de un tap a rayo visual (lineas 47-49 del frag oracular:
 * clip en plano lejano -> mundo -> direccion desde camara). Pura.
 */
export function unprojectDir(invVP: Mat4, camPos: Vec3, tapU: number, tapV: number): Vec3 {
  const clip: Vec4 = [tapU * 2 - 1, tapV * 2 - 1, 1, 1];
  const w = mat4Transform(invVP, clip);
  const iw = 1 / w[3];
  return vec3Normalize([w[0] * iw - camPos[0], w[1] * iw - camPos[1], w[2] * iw - camPos[2]]);
}

export function mat4Transform(m: Mat4, v: Vec4): Vec4 {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12] * v[3],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13] * v[3],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14] * v[3],
    m[3] * v[0] + m[7] * v[1] + m[11] * v[2] + m[15] * v[3],
  ];
}

export interface SunProj {
  x: number; // NDC
  y: number;
  behind: boolean; // w <= 0 (detras de camara)
  offscreen: boolean; // |x|>1 o |y|>1
}

// Sol lejano -> clip -> NDC (con w).
export function projectSun(viewProj: Mat4, camPos: Vec3, sunDir: Vec3): SunProj {
  const p: Vec4 = [
    camPos[0] + sunDir[0] * 100,
    camPos[1] + sunDir[1] * 100,
    camPos[2] + sunDir[2] * 100,
    1,
  ];
  const clip = mat4Transform(viewProj, p);
  const s: SunProj = { x: 0, y: 0, behind: true, offscreen: true };
  s.behind = clip[3] <= 0;
  if (!s.behind) {
    s.x = clip[0] / clip[3];
    s.y = clip[1] / clip[3];
    s.offscreen = s.x < -1 || s.x > 1 || s.y < -1 || s.y > 1;
  }
  return s;
}

// Test rayo-esfera (oclusora = Tierra r=1): true = el rayo cruza por delante.
export function rayHitsEarth(ro: Vec3, rd: Vec3): boolean {
  const b = vec3Dot(ro, rd);
  const c = vec3Dot(ro, ro) - EARTH_R * EARTH_R;
  const disc = b * b - c;
  if (disc < 0) return false;
  return -b + Math.sqrt(disc) > LIMB_GUARD;
}

// Peso del tap i (decay monotono).
export function tapWeight(i: number): number {
  return Math.pow(DECAY, i < 0 ? 0 : i);
}

export function falloff(dist: number): number {
  const f = 1 / (1 + FALLOFF_K * dist);
  return f < 0 ? 0 : f;
}

// Mascara del tap: 0 si su rayo visual cruza la Tierra, 1 si va al cielo.
export function tapMask(camPos: Vec3, tapDir: Vec3): number {
  return rayHitsEarth(camPos, tapDir) ? 0 : 1;
}

// Posicion UV del tap i entre el pixel y el sol (con correccion de aspecto
// y clamp al radio maximo). i=0 -> el propio pixel.
export function tapUV(i: number, uv: Vec2, sunUV: Vec2, aspect: number): Vec2 {
  const auvx = uv[0] * aspect;
  const auvy = uv[1];
  const dx = sunUV[0] * aspect - auvx;
  const dy = sunUV[1] - auvy;
  const L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1e-5) return [uv[0], uv[1]];
  const stepLen = (L < MAX_RADIUS ? L : MAX_RADIUS) / (NTAPS - 1);
  const ux = dx / L;
  const uy = dy / L;
  return [(auvx + ux * (stepLen * i)) / aspect, auvy + uy * (stepLen * i)];
}

// Puerta CPU: el pase NO se invoca si el sol esta detras/off-screen o tras
// el limbo (rayo camara->sol cruza la Tierra). Coste 0 por construccion.
export function gateSkip(s: SunProj, sunBehindLimb: boolean): boolean {
  return s.behind || s.offscreen || sunBehindLimb;
}

export interface PassState {
  /** false = pase apagado (puerta CPU). */
  visible: boolean;
  /** Sol en UV 0..1 (solo valido si visible). */
  sunUV: [number, number];
}

/**
 * Estado del pase por frame (P1-176): proyecta el sol visual (mismo vector
 * que el sprite: motor-consistente con uSunDir), aplica la puerta CPU y
 * devuelve el UV. El drape corregido no interviene: el pase trabaja en
 * pantalla, no en datos. Puro.
 */
export function godraysPassState(
  viewProj: Mat4,
  camPos: Vec3,
  sunDir: Vec3
): PassState {
  const s = projectSun(viewProj, camPos, sunDir);
  const n = vec3Normalize(sunDir);
  const behindLimb = rayHitsEarth(camPos, n);
  if (gateSkip(s, behindLimb)) return { visible: false, sunUV: [0, 0] };
  return { visible: true, sunUV: [s.x * 0.5 + 0.5, s.y * 0.5 + 0.5] };
}
