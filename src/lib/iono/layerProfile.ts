/**
 * Perfil de capas + constructor del volumen W-3 (spec 166-P1, primer tramo
 * del wiring): port de src/Ionosphere/LayerProfile.h (evalNeTotal con
 * winner, f2FloorKm, profileFromStation, sanitize) y de
 * buildDensityVolume (src/Ionosphere/DensityVolume.h). Puro: sin DOM,
 * sin three, sin GL.
 *
 * DECISION DECLARADA neTotal <-> evalNeTotal (n2 de 164/166): el nucleo
 * Chapman-alfa/Epstein es el mismo ya porteado en ionomath; la COMBINACION
 * difiere y ambas conviven: neTotal queda para radio/UI (sin winner, flare
 * interno desde xrayFlux, E/F1 atenuadas por dayFactor inline, F2 con
 * factor nocturno 0.25+0.75*dayFactor) y este evalNeTotal con winner para
 * el volumen (D con gate estricto cosChi>0 y flareFactor externo, E/F1 sin
 * atenuar --lo hace applyDayNight--, F2 plena + puerta f2Floor). Divergencia
 * de borde declarada: sanitizeB0 default 100 del oraculo vs 90 legacy de
 * ionomath (solo a entrada invalida; el builder usa el del oraculo).
 * Memoizacion del suelo por perfil (124 sec.2 pre-autorizada): el suelo
 * solo depende del perfil, el builder lo calcula una vez por celda de
 * perfil; bit-identico al ingenuo (pineado en el TU).
 */
import {
  densityDir,
  volumeAltKm,
  type DensityVolume,
} from "./densityVolume";

export const FO_TO_NM = 1.24e10; // Nm = 1.24e10 * fo^2 (fo MHz -> m^-3)

export interface LayerProfileTS {
  NmE: number;
  hmE: number;
  NmF1: number;
  hmF1: number;
  NmF2: number;
  hmF2: number;
  B0: number;
  B1: number;
  hasE: boolean;
  hasF1: boolean;
  hasF2: boolean;
}

export function blankProfile(): LayerProfileTS {
  return {
    NmE: 0, hmE: 110,
    NmF1: 0, hmF1: 180,
    NmF2: 0, hmF2: 300, B0: 100, B1: 3,
    hasE: false, hasF1: false, hasF2: false,
  };
}

// Saneado al ingerir (oraculo exacto, default B0 100 -- ver decision arriba).
export function sanitizeB0(v: number): number {
  if (!(v > 0)) return 100;
  if (v < 20) return 20;
  if (v > 300) return 300;
  return v;
}

export function sanitizeB1(v: number): number {
  if (!(v > 0)) return 3;
  if (v < 1.7) return 1.7;
  if (v > 4) return 4;
  return v;
}

/** Perfil desde frecuencias medidas (port de profileFromStation). */
export function profileFromFo(
  foE: number,
  foF1: number,
  foF2: number,
  hmF2: number,
  B0: number,
  B1: number,
  nmF2 = 0
): LayerProfileTS {
  const p = blankProfile();
  if (foE > 0) {
    p.NmE = FO_TO_NM * foE * foE;
    p.hmE = 110;
    p.hasE = true;
  }
  if (foF1 > 0) {
    p.NmF1 = FO_TO_NM * foF1 * foF1;
    // hF1 real no disponible: aproximacion de partida del oraculo.
    p.hmF1 = hmF2 > 0 ? Math.max(150, 0.8 * hmF2) : 180;
    p.hasF1 = true;
  }
  if (foF2 > 0 && hmF2 > 0) {
    p.NmF2 = nmF2 > 0 ? nmF2 : FO_TO_NM * foF2 * foF2;
    p.hmF2 = hmF2;
    p.B0 = sanitizeB0(B0);
    p.B1 = sanitizeB1(B1);
    p.hasF2 = true;
  }
  return p;
}

// Chapman-alfa: Ne(h) = Nm * exp(0.5 * (1 - z - exp(-z))), z = (h-hm)/H.
export function chapmanAlpha(Nm: number, hm: number, H: number, h: number): number {
  const z = (h - hm) / H;
  return Nm * Math.exp(0.5 * (1 - z - Math.exp(-z)));
}

/**
 * Suelo de validez F2 (ruling 124): mayor h con NeE(h) >= NeF2(h), clamp
 * hmE; NINGUNO (-1) sin hasE. Con early-out correcto (NmE <= NeF2(hmE)
 * => suelo = hmE) y barrido 1 km con Epstein bottomside 1:1.
 */
export function f2FloorKm(p: LayerProfileTS): number {
  if (!(p.hasE && p.hasF2)) return -1;
  {
    const B0e = p.B0 > 0 ? p.B0 : 100;
    const xe = (p.hmF2 - p.hmE) / B0e;
    const xmaxe = 1.6;
    const xce = xe < xmaxe ? xe : xmaxe;
    let NeF2AtHmE = p.NmF2 * Math.exp(-Math.pow(xce, p.B1) / Math.cosh(xce));
    if (xe > xmaxe) NeF2AtHmE *= Math.exp(-(xe - xmaxe) / 1.2);
    if (p.NmE <= NeF2AtHmE) return p.hmE;
  }
  let sup = p.hmE;
  for (let h = p.hmF2; h >= 60; h -= 1) {
    const e = chapmanAlpha(p.NmE, p.hmE, 10, h);
    const B0 = p.B0 > 0 ? p.B0 : 100;
    const x = (p.hmF2 - h) / B0;
    const xc = x < 1.6 ? x : 1.6;
    let f = p.NmF2 * Math.exp(-Math.pow(xc, p.B1) / Math.cosh(xc));
    if (x > 1.6) f *= Math.exp(-(x - 1.6) / 1.2);
    if (e >= f && h > sup) sup = h;
  }
  return sup;
}

export interface NeWinner {
  ne: number;
  /** Rama ganadora del max(): 0=D, 1=E, 2=F1, 3=F2; -1 ninguna. */
  winner: number;
}

function evalWithFloor(
  p: LayerProfileTS,
  hKm: number,
  cosChi: number,
  flareFactor: number,
  floor: number
): NeWinner {
  let best = 0;
  let win = -1;
  // D: sin fo medible; fondo Chapman Nm=1e9*sqrt(cosChi), H=10, hm=75.
  if (cosChi > 0) {
    const NmD = 1e9 * Math.sqrt(cosChi) * flareFactor;
    const v = chapmanAlpha(NmD, 75, 10, hKm);
    if (v > best) {
      best = v;
      win = 0;
    }
  }
  if (p.hasE) {
    const v = chapmanAlpha(p.NmE, p.hmE, 10, hKm);
    if (v > best) {
      best = v;
      win = 1;
    }
  }
  if (p.hasF1) {
    const v = chapmanAlpha(p.NmF1, p.hmF1, 25, hKm);
    if (v > best) {
      best = v;
      win = 2;
    }
  }
  if (p.hasF2) {
    let NeF2 = 0;
    if (hKm <= p.hmF2) {
      const B0 = p.B0 > 0 ? p.B0 : 100;
      const x = (p.hmF2 - hKm) / B0;
      const xmax = 1.6;
      const xc = x < xmax ? x : xmax;
      const base = p.NmF2 * Math.exp(-Math.pow(xc, p.B1) / Math.cosh(xc));
      NeF2 = x > xmax ? base * Math.exp(-(x - xmax) / 1.2) : base;
    } else {
      const Htop = 60 * (1 + (hKm - p.hmF2) / 300);
      NeF2 = p.NmF2 * Math.exp(-(hKm - p.hmF2) / Htop);
    }
    // Estricto: E gana su propio voxel pico (puerta del suelo).
    if (NeF2 > best) {
      best = NeF2;
      if (hKm > floor) win = 3;
    }
  }
  return { ne: best, winner: win };
}

/**
 * Densidad total [m^-3] a altura hKm (port de evalNeTotal).
 * winner: rama ganadora del max() (empates -> la mas baja).
 */
export function evalNeTotal(
  p: LayerProfileTS,
  hKm: number,
  cosChi: number,
  flareFactor: number
): NeWinner {
  return evalWithFloor(p, hKm, cosChi, flareFactor, f2FloorKm(p));
}

// Rango log10 [8, 12.5] -> [0,1].
export function normLogNe(ne: number): number {
  const l10 = ne > 0 ? Math.log10(ne) : 0;
  const n = (l10 - 8) / (12.5 - 8);
  return Math.min(1, Math.max(0, n));
}

/**
 * Construye el volumen muestreando evalNeTotal sobre la rejilla de
 * perfiles (un LayerProfileTS por celda, layout GridData). sunDir en el
 * marco del motor; flareFactor global >= 1. Suelo memoizado por perfil.
 */
export function buildDensityVolume(
  profiles: LayerProfileTS[],
  lonRes: number,
  latRes: number,
  altRes: number,
  altMinKm: number,
  altMaxKm: number,
  sunX: number,
  sunY: number,
  sunZ: number,
  flareFactor: number
): DensityVolume {
  const vol: DensityVolume = {
    lonRes,
    latRes,
    altRes,
    altMinKm,
    altMaxKm,
    data: new Array(lonRes * latRes * altRes).fill(0),
    layer: new Array(lonRes * latRes * altRes).fill(0),
    valid: false,
    timestamp: 0,
  };
  if (profiles.length !== lonRes * latRes) return vol;
  const floors = profiles.map((p) => f2FloorKm(p));
  for (let latIdx = 0; latIdx < latRes; latIdx++) {
    const latDeg = -90 + (180 * (latIdx + 0.5)) / latRes;
    for (let lonIdx = 0; lonIdx < lonRes; lonIdx++) {
      const lonDeg = -180 + (360 * (lonIdx + 0.5)) / lonRes;
      const [cx, cy, cz] = densityDir(latDeg, lonDeg);
      const cosChi = cx * sunX + cy * sunY + cz * sunZ;
      const pi = latIdx * lonRes + lonIdx;
      const p = profiles[pi];
      for (let a = 0; a < altRes; a++) {
        const h = volumeAltKm(a, altRes, altMinKm, altMaxKm);
        const r = evalWithFloor(p, h, cosChi, flareFactor, floors[pi]);
        const ii = (a * latRes + latIdx) * lonRes + lonIdx;
        vol.data[ii] = normLogNe(r.ne);
        vol.layer[ii] = r.winner < 0 ? 0 : r.winner > 3 ? 3 : r.winner;
      }
    }
  }
  vol.valid = true;
  return vol;
}
