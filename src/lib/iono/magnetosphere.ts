/**
 * Magnetosfera v1 W-4 (#4, ruling 252): IGRF dipolar + magnetopausa Shue
 * + servicio consultable B(r). Puro, sin GL, sin red. TU: magnetosphere.
 *
 * REFERENCIAS PINEADAS (regla 252: antes de código):
 * [S97] Shue et al. 1997, forma funcional r = r0·[2/(1+cosθ)]^α,
 *       JGR 102, 9497, doi:10.1029/97JA00196.
 * [S98] Shue et al. 1998, coeficientes mejorados (tanh único, sin ramas),
 *       JGR 103, 17691 — IMPLEMENTADOS (desviación declarada del 1997
 *       por partes: continuo, mejor en extremos; a adjudicar en veredicto):
 *       r0(Bz,Dp) = [10.22 + 1.29·tanh(0.184·(Bz+8.14))] / Dp^(1/6.6)
 *       α(Bz,Dp)  = (0.58 − 0.007·Bz)·[1 + 0.024·ln(Dp)]
 *       (Bz en nT, Dp en nPa, r0 en R_E, θ cenital solar en radianes.)
 * [IGRF] IGRF-14, grado 1, época 2025.0 CONGELADA (sin SV, espejo del
 *       spec de producción app Utils/Igrf.cpp: g10(2025) = −29350.0 nT
 *       testigo; fuente: ngdc.noaa.gov/IAGA/vmod/coeffs/igrf14coeffs.txt):
 *       g10 = −29350.0, g11 = −1410.30, h11 = 4545.50 (nT).
 *       Tilt = atan2(√(g11²+h11²), |g10|) = 9.21° (banda 9-12 ✓);
 *       polo N dipolar (80.79°N, 72.77°W) en el Ártico ✓.
 * [Dp] Dp[nPa] = 1.6726e-6 · n[cm⁻³] · v[km/s]² (mp·n·v²).
 * Cola v1: estiramiento nocturno PARAMETRIZADO y declarado (NO Tsyganenko):
 *       s = 1 + 0.15·max(0,−Bz)/5 aplicado antisolar (O4.6).
 */

// --- constantes pineadas ---
export const IGRF_DIPOLE_2025 = {
  g10: -29350.0,
  g11: -1410.3,
  h11: 4545.5,
  epoch: 2025.0,
  svApplied: false,
} as const;

export const DIPOLE_TILT_DEG = 9.21;
export const DIPOLE_POLE_N = { lat: 80.79, lon: -72.77 };

// B0 ecuatorial derivado de los coeficientes (nT a r = 1 R_E).
export const DIPOLE_B0_NT = Math.sqrt(
  IGRF_DIPOLE_2025.g10 ** 2 + IGRF_DIPOLE_2025.g11 ** 2 + IGRF_DIPOLE_2025.h11 ** 2,
); // ≈ 29733.5

export const SHUE = {
  r0c0: 10.22,
  r0c1: 1.29,
  r0k: 0.184,
  r0off: 8.14,
  r0exp: 1 / 6.6,
  a0: 0.58,
  a1: -0.007,
  a2: 0.024,
} as const;

export const EARTH_R_KM = 6371;

/** Distancia subsolar r0 en R_E (Shue-1998). */
export function shueR0(Bz_nT: number, Dp_nPa: number): number {
  const Dp = Math.max(Dp_nPa, 0.05);
  return (
    (SHUE.r0c0 + SHUE.r0c1 * Math.tanh(SHUE.r0k * (Bz_nT + SHUE.r0off))) /
    Math.pow(Dp, SHUE.r0exp)
  );
}

/** Flaring α (Shue-1998). */
export function shueAlpha(Bz_nT: number, Dp_nPa: number): number {
  const Dp = Math.max(Dp_nPa, 0.05);
  return (SHUE.a0 + SHUE.a1 * Bz_nT) * (1 + SHUE.a2 * Math.log(Dp));
}

/** Radio r(θ) en R_E; θ ∈ [0, π). θ→π diverge (la cola se corta en θmax). */
export function shueRadius(thetaRad: number, Bz_nT: number, Dp_nPa: number): number {
  const th = Math.min(Math.max(thetaRad, 0), Math.PI - 1e-3);
  const r0 = shueR0(Bz_nT, Dp_nPa);
  const al = shueAlpha(Bz_nT, Dp_nPa);
  return r0 * Math.pow(2 / (1 + Math.cos(th)), al);
}

/** Presión dinámica [nPa] desde n [cm⁻³] y v [km/s]. */
export function dynamicPressure(n_cm3: number, v_kms: number): number {
  return 1.6726e-6 * Math.max(n_cm3, 0) * v_kms * v_kms;
}

// --- dipolo en marco WEB (Y-up de la escena: X=lon0, Y=norte, Z=-lon90E,
//   misma convención que latLonToVec3/vec3ToLatLon de geo.ts) ---
// IGRF GEO estándar (x=lon0, y=lon90E, z=norte) -> WEB: (x, z, -y).
// m_IGRF ∝ (g11, h11, g10)  =>  m_WEB ∝ (g11, g10, -h11).

import { latLonToVec3, vec3ToLatLon } from "./geo";

export type Vec3 = [number, number, number];

/** Momento dipolar unitario en marco WEB = (g11, g10, -h11)/|..|. */
export function dipoleMoment(): Vec3 {
  const { g10, g11, h11 } = IGRF_DIPOLE_2025;
  const n = Math.hypot(g10, g11, h11);
  return [g11 / n, g10 / n, -h11 / n];
}

/** B dipolar unitario en la dirección r̂: 3(m·r̂)r̂ − m. */
export function dipoleBUnit(rx: number, ry: number, rz: number): Vec3 {
  const [mx, my, mz] = dipoleMoment();
  const d = mx * rx + my * ry + mz * rz;
  return [3 * d * rx - mx, 3 * d * ry - my, 3 * d * rz - mz];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function norm(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / n, v[1] / n, v[2] / n];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/** Base ortonormal con z = m (marco magnético -> GEO). */
function magBasis(): { u: Vec3; v: Vec3; m: Vec3 } {
  const m = dipoleMoment();
  const ref: Vec3 = Math.abs(m[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(m, ref));
  const v = cross(m, u);
  return { u, v, m };
}

/** GEO unitario -> coordenadas magnéticas (x,y,z con z = eje dipolar). */
export function toMag(r: Vec3): Vec3 {
  const { u, v, m } = magBasis();
  return [dot(r, u), dot(r, v), dot(r, m)];
}

/** Magnéticas -> GEO unitario. */
export function fromMag(q: Vec3): Vec3 {
  const { u, v, m } = magBasis();
  const x = q[0] * u[0] + q[1] * v[0] + q[2] * m[0];
  const y = q[0] * u[1] + q[1] * v[1] + q[2] * m[1];
  const z = q[0] * u[2] + q[1] * v[2] + q[2] * m[2];
  return norm([x, y, z]);
}

/**
 * SERVICIO B(r) (requisito no negociable O4.5): campo dipolar en nT en
 * (lat, lon, altKm) geográficos. De él cuelgan #8/#17/#18/#19 sin refactor.
 */
export function magnetosphereField(latDeg: number, lonDeg: number, altKm: number): Vec3 {
  const [x, y, z] = latLonToVec3(latDeg, lonDeg, 1);
  const B = dipoleBUnit(x, y, z);
  const rr = 1 + Math.max(altKm, 0) / EARTH_R_KM;
  const k = DIPOLE_B0_NT / (rr * rr * rr);
  return [B[0] * k, B[1] * k, B[2] * k];
}

/** Módulo |B| en nT (útil para TU y panel). */
export function fieldMagnitudeNt(latDeg: number, lonDeg: number, altKm: number): number {
  const B = magnetosphereField(latDeg, lonDeg, altKm);
  return Math.hypot(B[0], B[1], B[2]);
}

/** Longitud del meridiano de medianoche: lon del punto antisolar
 *  (inversa exacta, cero riesgo de convención). */
export function midnightLon(sunX: number, sunY: number, sunZ: number): number {
  return vec3ToLatLon(-sunX, -sunY, -sunZ).lon;
}

/**
 * Trazado analítico al conjugado (dipolo exacto r = L·cos²λ):
 * mismo meridiano magnético, latitud espejada. O4.5 lo ejercita.
 */
export function traceConjugate(latDeg: number, lonDeg: number): { lat: number; lon: number; L: number } {
  const [x, y, z] = latLonToVec3(latDeg, lonDeg, 1);
  const q = toMag([x, y, z]);
  const rxy = Math.hypot(q[0], q[1]);
  const latM = Math.atan2(q[2], rxy);
  const lonM = Math.atan2(q[1], q[0]);
  const L = 1 / (Math.cos(latM) * Math.cos(latM) + 1e-12);
  const qc: Vec3 = [Math.cos(-latM) * Math.cos(lonM), Math.cos(-latM) * Math.sin(lonM), Math.sin(-latM)];
  const g = fromMag(qc);
  const inv = vec3ToLatLon(g[0], g[1], g[2]);
  return { lat: inv.lat, lon: inv.lon, L };
}

/** Puntos de una línea dipolar (cáscara L, meridiano magnético lonM,
 *  marco GEO unitario × R_E). */
export function dipoleLinePoints(L: number, magLonDeg = 0, n = 64): Vec3[] {
  const lamMax = Math.acos(Math.sqrt(1 / Math.max(L, 1)));
  const ph = (magLonDeg * Math.PI) / 180;
  const pts: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const lam = -lamMax + (2 * lamMax * i) / n;
    const r = L * Math.cos(lam) * Math.cos(lam);
    const q: Vec3 = [r * Math.cos(lam) * Math.cos(ph), r * Math.cos(lam) * Math.sin(ph), r * Math.sin(lam)];
    pts.push(fromMag(q));
  }
  return pts;
}

/** Factor de estiramiento de cola nocturna (v1 declarado, O4.6). */
export function tailStretch(Bz_nT: number): number {
  return 1 + (0.15 * Math.max(0, -Bz_nT)) / 5;
}

export interface MagnetopauseMesh {
  rings: Vec3[][];
  meridians: Vec3[][];
  r0: number;
  alpha: number;
  tail: number;
}

/** Malla wireframe de la magnetopausa en marco solar (+x al Sol).
 *  Anillos θ=15..135° (48 pts) + meridianos φ c/45° (θ 5..150°).
 *  Cola (x<0) estirada ×tail (v1 declarado). */
export function magnetopauseMesh(Bz_nT: number, Dp_nPa: number): MagnetopauseMesh {
  const r0 = shueR0(Bz_nT, Dp_nPa);
  const al = shueAlpha(Bz_nT, Dp_nPa);
  const s = tailStretch(Bz_nT);
  const D2R = Math.PI / 180;
  const pt = (thDeg: number, phDeg: number): Vec3 => {
    const th = thDeg * D2R;
    const ph = phDeg * D2R;
    const r = r0 * Math.pow(2 / (1 + Math.cos(th)), al);
    let x = r * Math.cos(th);
    if (x < 0) x *= s;
    const rho = Math.sqrt(Math.max(r * r - x * x, 0));
    return [x, rho * Math.cos(ph), rho * Math.sin(ph)];
  };
  const rings: Vec3[][] = [];
  for (let th = 15; th <= 135; th += 15) {
    const ring: Vec3[] = [];
    for (let i = 0; i <= 48; i++) ring.push(pt(th, (i / 48) * 360));
    rings.push(ring);
  }
  const meridians: Vec3[][] = [];
  for (let m = 0; m < 8; m++) {
    const mer: Vec3[] = [];
    for (let i = 0; i <= 30; i++) mer.push(pt(5 + (145 * i) / 30, m * 45));
    meridians.push(mer);
  }
  return { rings, meridians, r0, alpha: al, tail: s };
}

/** Clave de rebuild (r0/alfa/cola redondeados: evita thrashing). */
export function magnetoKey(Bz_nT: number, Dp_nPa: number): string {
  const r0 = shueR0(Bz_nT, Dp_nPa);
  const al = shueAlpha(Bz_nT, Dp_nPa);
  return `${r0.toFixed(2)}|${al.toFixed(3)}|${tailStretch(Bz_nT).toFixed(3)}`;
}
