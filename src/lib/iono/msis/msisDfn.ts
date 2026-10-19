// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — NRLMSIS 2.1 species density profiles (drop 9c, F2b #9).
//
// TypeScript transcription of `msis_dfn.F90` from the NRLMSIS 2.1
// reference package (NRL-SOF-014-1, mirror pinned at
// jacobwilliams/NRLMSIS2.1 commit 9124144).
// Source sha256:
// a77a2e2bd186d985d0ee40efc2ad2565f60ec98e2f3254c1a9334eee751142b2
// Faithful translation without physics changes
// (traducción fiel sin cambios de física). Translated 2026-10-16.
//
// NRL-SOF section 4(b) compliance: verbatim translation of the logic;
// the original copyright notice is reproduced in
// `nrlmsis2.1_license.txt` in this directory. Portions of NRLMSIS
// Copyright (C) 2021 U.S. Naval Research Laboratory.
//
// Notes: zero-initialized dpro (Fortran intent(out) is undefined, but
// the evaluation only reads assigned fields per species). `**` maps to
// Math.pow as written.

import {
  TANH1,
  SPECMASS,
  LNVMR,
  MBAR,
  G0DIVKB,
  DMISSING,
  ND,
  ZETAF,
  ZETAB,
  ZETAA,
  NODES_TN,
  NODES_O1,
  ZETAREF_O1,
  C1O1,
  C1O1ADJ,
  NODES_NO,
  ZETAREF_NO,
  C1NO,
  C1NOADJ,
  ZETAREF_OA,
  HOA,
  NSPLNO,
  NSPLO1,
  NDO1,
  NDNO,
  NMAG,
  NUT,
  CMAG,
  CUT,
  MBF,
} from "./msisConstants";
import type { MsisState, MsisSubset } from "./msisInit";
import { bspline, dilog } from "./msisUtils";
import type { TnParm } from "./msisTfn";
import { sfluxmod, geomag, utdep } from "./msisGfn";

/** Species density profile parameters (dnparm). cf has 10 slots (0..9). */
export interface DnParm {
  lnPhiF: number;
  lndref: number;
  zetaM: number;
  HML: number;
  HMU: number;
  C: number;
  zetaC: number;
  HC: number;
  R: number;
  zetaR: number;
  HR: number;
  cf: number[];
  zref: number;
  Mi: number[];
  zetaMi: number[];
  aMi: number[];
  WMi: number[];
  XMi: number[];
  Izref: number;
  Tref: number;
  zmin: number;
  zhyd: number;
  ispec: number;
}

function zeroDnparm(): DnParm {
  return {
    lnPhiF: 0, lndref: 0, zetaM: 0, HML: 0, HMU: 0,
    C: 0, zetaC: 0, HC: 0, R: 0, zetaR: 0, HR: 0,
    cf: new Array<number>(10).fill(0),
    zref: 0,
    Mi: new Array<number>(5).fill(0),
    zetaMi: new Array<number>(5).fill(0),
    aMi: new Array<number>(5).fill(0),
    WMi: new Array<number>(5).fill(0),
    XMi: new Array<number>(5).fill(0),
    Izref: 0, Tref: 0, zmin: 0, zhyd: 0, ispec: 0,
  };
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += a[k] * b[k];
  return s;
}

function colRows(subset: MsisSubset, rows: number[], col: number): number[] {
  return rows.map((r) => subset.beta[r][col]);
}

function range(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let k = lo; k <= hi; k++) out.push(k);
  return out;
}

function gfSlice(gf: number[], lo: number, hi: number): number[] {
  return gf.slice(lo, hi + 1);
}

/** Slice a 14-element gf section as the geomag plg(0:6,0:1) table. */
function slicePlg(gf: number[], base: number): number[][] {
  const plg: number[][] = [];
  for (let i = 0; i <= 6; i++) {
    plg[i] = [gf[base + i], gf[base + i + 7]];
  }
  return plg;
}

function geomagOf(state: MsisState, subset: MsisSubset, col: number, gf: number[]): number {
  return geomag(
    state,
    colRows(subset, range(CMAG, CMAG + NMAG - 1), col),
    gfSlice(gf, CMAG, CMAG + 12),
    slicePlg(gf, CMAG + 13),
  );
}

function utdepOf(state: MsisState, subset: MsisSubset, col: number, gf: number[]): number {
  return utdep(
    state,
    colRows(subset, range(CUT, CUT + NUT - 1), col),
    gfSlice(gf, CUT, CUT + 8),
  );
}

/**
 * DFNPARM: species density profile parameters for species ispec (2..10).
 * Subsets are taken from the model state (same module data as TN…NO).
 */
export function dfnparm(
  state: MsisState,
  ispec: number,
  gf: number[],
  tpro: TnParm,
): DnParm {
  const { N2, O2, O1, HE, H1, AR, N1, OA, NO } = state;
  const linRows = range(0, MBF);
  const linGf = gfSlice(gf, 0, MBF);
  const dpro = zeroDnparm();
  dpro.ispec = ispec;

  switch (ispec) {
    case 2: { // Molecular Nitrogen
      dpro.lnPhiF = LNVMR[ispec];
      dpro.lndref = tpro.lndtotF + dpro.lnPhiF;
      dpro.zref = ZETAF;
      dpro.zmin = -1.0;
      dpro.zhyd = ZETAF;
      dpro.zetaM = dot(colRows(N2, linRows, 1), linGf);
      dpro.HML = N2.beta[0][2];
      dpro.HMU = N2.beta[0][3];
      dpro.R = 0;
      if (state.N2Rflag) dpro.R = dot(colRows(N2, linRows, 7), linGf);
      dpro.zetaR = N2.beta[0][8];
      dpro.HR = N2.beta[0][9];
      break;
    }
    case 3: { // Molecular Oxygen
      dpro.lnPhiF = LNVMR[ispec];
      dpro.lndref = tpro.lndtotF + dpro.lnPhiF;
      dpro.zref = ZETAF;
      dpro.zmin = -1.0;
      dpro.zhyd = ZETAF;
      dpro.zetaM = O2.beta[0][1];
      dpro.HML = O2.beta[0][2];
      dpro.HMU = O2.beta[0][3];
      dpro.R = dot(colRows(O2, linRows, 7), linGf);
      dpro.R = dpro.R + geomagOf(state, O2, 7, gf);
      dpro.zetaR = O2.beta[0][8];
      dpro.HR = O2.beta[0][9];
      break;
    }
    case 4: { // Atomic Oxygen
      dpro.lnPhiF = 0;
      dpro.lndref = dot(colRows(O1, linRows, 0), linGf);
      dpro.zref = ZETAREF_O1;
      dpro.zmin = NODES_O1[3];
      dpro.zhyd = ZETAREF_O1;
      dpro.zetaM = O1.beta[0][1];
      dpro.HML = O1.beta[0][2];
      dpro.HMU = O1.beta[0][3];
      dpro.C = dot(colRows(O1, linRows, 4), linGf);
      dpro.zetaC = O1.beta[0][5];
      dpro.HC = O1.beta[0][6];
      dpro.R = dot(colRows(O1, linRows, 7), linGf);
      dpro.R = dpro.R + sfluxmod(state, 7, gf, O1, 0.0);
      dpro.R = dpro.R + geomagOf(state, O1, 7, gf);
      dpro.R = dpro.R + utdepOf(state, O1, 7, gf);
      dpro.zetaR = O1.beta[0][8];
      dpro.HR = O1.beta[0][9];
      for (let izf = 0; izf <= NSPLO1 - 1; izf++) {
        dpro.cf[izf] = dot(colRows(O1, linRows, izf + 10), linGf);
      }
      break; // Constrained splines calculated after switch
    }
    case 5: { // Helium
      dpro.lnPhiF = LNVMR[ispec];
      dpro.lndref = tpro.lndtotF + dpro.lnPhiF;
      dpro.zref = ZETAF;
      dpro.zmin = -1.0;
      dpro.zhyd = ZETAF;
      dpro.zetaM = HE.beta[0][1];
      dpro.HML = HE.beta[0][2];
      dpro.HMU = HE.beta[0][3];
      dpro.R = dot(colRows(HE, linRows, 7), linGf);
      dpro.R = dpro.R + sfluxmod(state, 7, gf, HE, 1.0);
      dpro.R = dpro.R + geomagOf(state, HE, 7, gf);
      dpro.R = dpro.R + utdepOf(state, HE, 7, gf);
      dpro.zetaR = HE.beta[0][8];
      dpro.HR = HE.beta[0][9];
      break;
    }
    case 6: { // Atomic Hydrogen
      dpro.lnPhiF = 0;
      dpro.lndref = dot(colRows(H1, linRows, 0), linGf);
      dpro.zref = ZETAA;
      dpro.zmin = 75.0;
      dpro.zhyd = ZETAF;
      dpro.zetaM = H1.beta[0][1];
      dpro.HML = H1.beta[0][2];
      dpro.HMU = H1.beta[0][3];
      dpro.C = dot(colRows(H1, linRows, 4), linGf);
      dpro.zetaC = dot(colRows(H1, linRows, 5), linGf);
      dpro.HC = H1.beta[0][6];
      dpro.R = dot(colRows(H1, linRows, 7), linGf);
      dpro.R = dpro.R + sfluxmod(state, 7, gf, H1, 0.0);
      dpro.R = dpro.R + geomagOf(state, H1, 7, gf);
      dpro.R = dpro.R + utdepOf(state, H1, 7, gf);
      dpro.zetaR = H1.beta[0][8];
      dpro.HR = H1.beta[0][9];
      break;
    }
    case 7: { // Argon
      dpro.lnPhiF = LNVMR[ispec];
      dpro.lndref = tpro.lndtotF + dpro.lnPhiF;
      dpro.zref = ZETAF;
      dpro.zmin = -1.0;
      dpro.zhyd = ZETAF;
      dpro.zetaM = AR.beta[0][1];
      dpro.HML = AR.beta[0][2];
      dpro.HMU = AR.beta[0][3];
      dpro.R = dot(colRows(AR, linRows, 7), linGf);
      dpro.R = dpro.R + geomagOf(state, AR, 7, gf);
      dpro.R = dpro.R + utdepOf(state, AR, 7, gf);
      dpro.zetaR = AR.beta[0][8];
      dpro.HR = AR.beta[0][9];
      break;
    }
    case 8: { // Atomic Nitrogen
      dpro.lnPhiF = 0;
      dpro.lndref = dot(colRows(N1, linRows, 0), linGf);
      dpro.lndref = dpro.lndref + sfluxmod(state, 0, gf, N1, 0.0);
      dpro.lndref = dpro.lndref + geomagOf(state, N1, 0, gf);
      dpro.lndref = dpro.lndref + utdepOf(state, N1, 0, gf);
      dpro.zref = ZETAB;
      dpro.zmin = 90.0;
      dpro.zhyd = ZETAF;
      dpro.zetaM = N1.beta[0][1];
      dpro.HML = N1.beta[0][2];
      dpro.HMU = N1.beta[0][3];
      dpro.C = N1.beta[0][4];
      dpro.zetaC = N1.beta[0][5];
      dpro.HC = N1.beta[0][6];
      dpro.R = dot(colRows(N1, linRows, 7), linGf);
      dpro.zetaR = N1.beta[0][8];
      dpro.HR = N1.beta[0][9];
      break;
    }
    case 9: { // Anomalous Oxygen (legacy profile)
      dpro.lndref = dot(colRows(OA, linRows, 0), linGf);
      dpro.lndref = dpro.lndref + geomagOf(state, OA, 0, gf);
      dpro.zref = ZETAREF_OA;
      dpro.zmin = 120.0;
      dpro.zhyd = 0;
      dpro.C = OA.beta[0][4];
      dpro.zetaC = OA.beta[0][5];
      dpro.HC = OA.beta[0][6];
      return dpro; // No further parameters needed for legacy anomalous oxygen profile
    }
    case 10: { // Nitric Oxide
      if (NO.beta[0][0] === 0) {
        dpro.lndref = 0;
        return dpro; // Skip if parameters are not defined
      }
      dpro.lnPhiF = 0;
      dpro.lndref = dot(colRows(NO, linRows, 0), linGf);
      dpro.lndref = dpro.lndref + geomagOf(state, NO, 0, gf);
      dpro.zref = ZETAREF_NO;
      dpro.zmin = 72.5; // Cut off below 72.5 km (spline artefacts at domain edge)
      dpro.zhyd = ZETAREF_NO;
      dpro.zetaM = dot(colRows(NO, linRows, 1), linGf);
      dpro.HML = dot(colRows(NO, linRows, 2), linGf);
      dpro.HMU = dot(colRows(NO, linRows, 3), linGf);
      dpro.C = dot(colRows(NO, linRows, 4), linGf);
      dpro.C = dpro.C + geomagOf(state, NO, 4, gf);
      dpro.zetaC = dot(colRows(NO, linRows, 5), linGf);
      dpro.HC = dot(colRows(NO, linRows, 6), linGf);
      dpro.R = dot(colRows(NO, linRows, 7), linGf);
      dpro.zetaR = dot(colRows(NO, linRows, 8), linGf);
      dpro.HR = dot(colRows(NO, linRows, 9), linGf);
      for (let izf = 0; izf <= NSPLNO - 1; izf++) {
        dpro.cf[izf] = dot(colRows(NO, linRows, izf + 10), linGf);
        dpro.cf[izf] =
          dpro.cf[izf] + geomagOf(state, NO, izf + 10, gf);
      }
      break; // Constrained splines calculated after switch
    }
    default:
      throw new Error("msis: species not yet implemented");
  }

  // Piecewise mass profile values and integration terms
  dpro.zetaMi[0] = dpro.zetaM - 2.0 * dpro.HML;
  dpro.zetaMi[1] = dpro.zetaM - dpro.HML;
  dpro.zetaMi[2] = dpro.zetaM;
  dpro.zetaMi[3] = dpro.zetaM + dpro.HMU;
  dpro.zetaMi[4] = dpro.zetaM + 2.0 * dpro.HMU;
  dpro.Mi[0] = MBAR;
  dpro.Mi[4] = SPECMASS[ispec];
  dpro.Mi[2] = (dpro.Mi[0] + dpro.Mi[4]) / 2.0;
  const delM = (TANH1 * (dpro.Mi[4] - dpro.Mi[0])) / 2.0;
  dpro.Mi[1] = dpro.Mi[2] - delM;
  dpro.Mi[3] = dpro.Mi[2] + delM;
  for (let i = 0; i <= 3; i++) {
    dpro.aMi[i] =
      (dpro.Mi[i + 1] - dpro.Mi[i]) / (dpro.zetaMi[i + 1] - dpro.zetaMi[i]);
  }
  for (let i = 0; i <= 4; i++) {
    const delz = dpro.zetaMi[i] - ZETAB;
    if (dpro.zetaMi[i] < ZETAB) {
      const { i: iz, S: Si } = bspline(dpro.zetaMi[i], NODES_TN, ND + 2, 6, state.etaTN);
      dpro.WMi[i] =
        dot(tpro.gamma.slice(iz - 5, iz + 1), [
          Si[0][6], Si[1][6], Si[2][6], Si[3][6], Si[4][6], Si[5][6],
        ]) +
        tpro.cVs * delz +
        tpro.cWs;
    } else {
      dpro.WMi[i] =
        (0.5 * delz * delz + dilog(tpro.b * Math.exp(-tpro.sigma * delz)) / tpro.sigmasq) /
          tpro.tex +
        tpro.cVb * delz +
        tpro.cWb;
    }
  }
  dpro.XMi[0] = -dpro.aMi[0] * dpro.WMi[0];
  for (let i = 1; i <= 3; i++) {
    dpro.XMi[i] = dpro.XMi[i - 1] - dpro.WMi[i] * (dpro.aMi[i] - dpro.aMi[i - 1]);
  }
  dpro.XMi[4] = dpro.XMi[3] + dpro.WMi[4] * dpro.aMi[3];

  // Hydrostatic integral at reference height, and copy temperature
  let Mzref: number;
  if (dpro.zref === ZETAF) {
    Mzref = MBAR;
    dpro.Tref = tpro.tzetaF;
    dpro.Izref = MBAR * tpro.VzetaF;
  } else if (dpro.zref === ZETAB) {
    Mzref = pwmp(dpro.zref, dpro.zetaMi, dpro.Mi, dpro.aMi);
    dpro.Tref = tpro.tb0;
    dpro.Izref = 0;
    if (ZETAB > dpro.zetaMi[0] && ZETAB < dpro.zetaMi[4]) {
      let i = 0;
      for (let i1 = 1; i1 <= 3; i1++) {
        if (ZETAB < dpro.zetaMi[i1]) break;
        else i = i1;
      }
      dpro.Izref = dpro.Izref - dpro.XMi[i];
    } else {
      dpro.Izref = dpro.Izref - dpro.XMi[4];
    }
  } else if (dpro.zref === ZETAA) {
    Mzref = pwmp(dpro.zref, dpro.zetaMi, dpro.Mi, dpro.aMi);
    dpro.Tref = tpro.tzetaA;
    dpro.Izref = Mzref * tpro.VzetaA;
    if (ZETAA > dpro.zetaMi[0] && ZETAA < dpro.zetaMi[4]) {
      let i = 0;
      for (let i1 = 1; i1 <= 3; i1++) {
        if (ZETAA < dpro.zetaMi[i1]) break;
        else i = i1;
      }
      dpro.Izref = dpro.Izref - (dpro.aMi[i] * tpro.WzetaA + dpro.XMi[i]);
    } else {
      dpro.Izref = dpro.Izref - dpro.XMi[4];
    }
  } else {
    throw new Error("msis: integrals at reference height not available");
  }

  // C1 constraint for O1 at 85 km
  if (ispec === 4) {
    const Cterm = dpro.C * Math.exp(-(dpro.zref - dpro.zetaC) / dpro.HC);
    const Rterm0 = Math.tanh((dpro.zref - dpro.zetaR) / (state.HRfactO1ref * dpro.HR));
    const Rterm = dpro.R * (1 + Rterm0);
    const bc0 =
      dpro.lndref - Cterm + Rterm - dpro.cf[7] * C1O1ADJ[0];
    const bc1 =
      ((-Mzref * G0DIVKB) / tpro.tzetaA) -
      tpro.dlntdzA +
      Cterm / dpro.HC +
      ((Rterm * (1 - Rterm0)) / dpro.HR) * state.dHRfactO1ref -
      dpro.cf[7] * C1O1ADJ[1];
    dpro.cf[8] = bc0 * C1O1[0][0] + bc1 * C1O1[1][0];
    dpro.cf[9] = bc0 * C1O1[0][1] + bc1 * C1O1[1][1];
  }

  // C1 constraint for NO at 122.5 km
  if (ispec === 10) {
    const Cterm = dpro.C * Math.exp(-(dpro.zref - dpro.zetaC) / dpro.HC);
    const Rterm0 = Math.tanh((dpro.zref - dpro.zetaR) / (state.HRfactNOref * dpro.HR));
    const Rterm = dpro.R * (1 + Rterm0);
    const bc0 =
      dpro.lndref - Cterm + Rterm - dpro.cf[7] * C1NOADJ[0];
    const bc1 =
      ((-Mzref * G0DIVKB) / tpro.tb0) -
      tpro.tgb0 / tpro.tb0 +
      Cterm / dpro.HC +
      ((Rterm * (1 - Rterm0)) / dpro.HR) * state.dHRfactNOref -
      dpro.cf[7] * C1NOADJ[1];
    dpro.cf[8] = bc0 * C1NO[0][0] + bc1 * C1NO[1][0];
    dpro.cf[9] = bc0 * C1NO[0][1] + bc1 * C1NO[1][1];
  }

  return dpro;
}

// ---------------------------------------------------------------------------
// DFNX: species density at geopotential height z (m^-3, or dmissing)
// ---------------------------------------------------------------------------

export function dfnx(
  state: MsisState,
  z: number,
  tnz: number,
  lndtotz: number,
  Vz: number,
  Wz: number,
  HRfact: number,
  tpro: TnParm,
  dpro: DnParm,
): number {
  // Below minimum height of profile
  if (z < dpro.zmin) return DMISSING;

  // Anomalous Oxygen (legacy MSISE-00 formulation)
  if (dpro.ispec === 9) {
    const ln =
      dpro.lndref - (z - dpro.zref) / HOA - dpro.C * Math.exp(-(z - dpro.zetaC) / dpro.HC);
    return Math.exp(ln);
  }

  // Nitric Oxide: skip if parameters are not defined
  if (dpro.ispec === 10 && dpro.lndref === 0) return DMISSING;

  // Chapman and logistic corrections
  let ccor: number;
  switch (dpro.ispec) {
    case 2:
    case 3:
    case 5:
    case 7: // N2, O2, He, Ar: logistic correction only
      ccor = dpro.R * (1 + Math.tanh((z - dpro.zetaR) / (HRfact * dpro.HR)));
      break;
    default: // O, H, N, NO: Chapman and logistic corrections
      ccor =
        -dpro.C * Math.exp(-(z - dpro.zetaC) / dpro.HC) +
        dpro.R * (1 + Math.tanh((z - dpro.zetaR) / (HRfact * dpro.HR)));
      break;
  }

  // Below height where hydrostatic terms are needed
  if (z < dpro.zhyd) {
    switch (dpro.ispec) {
      case 2:
      case 3:
      case 5:
      case 7: // Mixing ratios, exit
        return Math.exp(lndtotz + dpro.lnPhiF + ccor);
      case 4: { // O: evaluate splines
        const { i: iz, S: Sz } = bspline(z, NODES_O1, NDO1, 4, state.etaO1);
        return Math.exp(dot(dpro.cf.slice(iz - 3, iz + 1), [Sz[2][4], Sz[3][4], Sz[4][4], Sz[5][4]]));
      }
      case 10: { // NO: evaluate splines
        const { i: iz, S: Sz } = bspline(z, NODES_NO, NDNO, 4, state.etaNO);
        return Math.exp(dot(dpro.cf.slice(iz - 3, iz + 1), [Sz[2][4], Sz[3][4], Sz[4][4], Sz[5][4]]));
      }
      default:
        break; // H, N cannot reach here (zmin > zhyd); fall through
    }
  }

  // Hydrostatic term applied to reference density
  const Mz = pwmp(z, dpro.zetaMi, dpro.Mi, dpro.aMi);
  let Ihyd = Mz * Vz - dpro.Izref;
  if (z > dpro.zetaMi[0] && z < dpro.zetaMi[4]) {
    let i = 0;
    for (let i1 = 1; i1 <= 3; i1++) {
      if (z < dpro.zetaMi[i1]) break;
      else i = i1;
    }
    Ihyd = Ihyd - (dpro.aMi[i] * Wz + dpro.XMi[i]);
  } else if (z >= dpro.zetaMi[4]) {
    Ihyd = Ihyd - dpro.XMi[4];
  }
  const ln = dpro.lndref - Ihyd * G0DIVKB + ccor;

  // Ideal gas law
  return Math.exp(ln) * (dpro.Tref / tnz);
}

// ---------------------------------------------------------------------------
// PWMP: piecewise effective mass profile interpolation
// ---------------------------------------------------------------------------

export function pwmp(z: number, zm: number[], m: number[], dmdz: number[]): number {
  // Most probable case
  if (z >= zm[4]) return m[4];
  // Second most probable case
  if (z <= zm[0]) return m[0];
  // None of the above
  for (let inode = 0; inode <= 3; inode++) {
    if (z < zm[inode + 1]) return m[inode] + dmdz[inode] * (z - zm[inode]);
  }
  throw new Error("msis: error in pwmp");
}
