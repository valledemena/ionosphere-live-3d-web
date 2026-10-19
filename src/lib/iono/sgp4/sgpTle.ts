// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — TLE parser for the SGP4 port (drop 313, F2b #10).
//
// Covers the twoline2rv front-end of SGP4.cpp (Vallado C++ reference,
// AIAA-2006-6753 bundle). Header mirrored from the source file.
// Translated 2026-10-17. Faithful translation without physics changes
// (traducción fiel sin cambios de física).
//
// Checksum rule (TLE standard, enforced by default): sum of all digits
// in columns 1..68 plus 1 for each '-' sign, modulo 10, must equal the
// digit in column 69. The 3 intentional error-case TLEs of the official
// verification set carry invalid checksums BY DESIGN (documented) and
// are parsed in lenient mode only for the return-code tests.

import { newElsetRec, sgp4init, jday, days2mdhms, type ElsetRec, type GravConstKind } from "./sgp4";

export interface TleElements {
  satnum: string;
  classification: string;
  intldesg: string;
  epochyr: number;
  epochdays: number;
  ndot: number;
  nddot: number;
  nexp: number;
  bstar: number;
  ibexp: number;
  ephtype: number;
  elnum: number;
  inclo: number;
  nodeo: number;
  ecco: number;
  argpo: number;
  mo: number;
  noKozai: number;
  revnum: number;
  startmfe: number | null;
  stopmfe: number | null;
  deltamin: number | null;
  checksumOk1: boolean;
  checksumOk2: boolean;
}

/** TLE line checksum over columns 1..68 (0-based 0..67). */
export function tleChecksumOk(line: string): boolean {
  if (line.length < 69) return false;
  let sum = 0;
  for (let k = 0; k < 68; k++) {
    const ch = line[k];
    if (ch >= "0" && ch <= "9") sum += ch.charCodeAt(0) - 48;
    else if (ch === "-") sum += 1;
  }
  const check = line[68];
  return check >= "0" && check <= "9" && sum % 10 === check.charCodeAt(0) - 48;
}

interface Scanner {
  s: string;
  i: number;
}

function skipWs(sc: Scanner): void {
  while (
    sc.i < sc.s.length &&
    (sc.s[sc.i] === " " || sc.s[sc.i] === "\t" || sc.s[sc.i] === "\n" || sc.s[sc.i] === "\r")
  )
    sc.i++;
}

/** C strtol semantics, base 10, longest valid prefix within width. */
function scanInt(sc: Scanner, width: number): number {
  skipWs(sc);
  const sub = sc.s.slice(sc.i, sc.i + width);
  const m = /^[+-]?[0-9]+/.exec(sub);
  if (!m) throw new Error(`sgp4: bad int field near offset ${sc.i}`);
  sc.i += m[0].length;
  return parseInt(m[0], 10);
}

/** C strtod semantics (no hex/inf/nan — TLE domain), longest prefix. */
function scanFloat(sc: Scanner, width: number): number {
  skipWs(sc);
  const sub = sc.s.slice(sc.i, sc.i + width);
  const m = /^[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?/.exec(sub);
  if (!m) throw new Error(`sgp4: bad float field near offset ${sc.i}`);
  sc.i += m[0].length;
  return parseFloat(m[0]);
}

function scanChars(sc: Scanner, width: number): string {
  skipWs(sc);
  let out = "";
  while (out.length < width && sc.i < sc.s.length) {
    const ch = sc.s[sc.i];
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") break;
    out += ch;
    sc.i++;
  }
  return out;
}

function scanRaw(sc: Scanner, width: number): string {
  const out = sc.s.slice(sc.i, sc.i + width);
  sc.i += out.length;
  return out;
}

/** Apply the C char-surgery to mutable line buffers (exact indices). */
function surgery(l1: string[], l2: string[]): void {
  for (let j = 10; j <= 15; j++) if (l1[j] === " ") l1[j] = "_";
  if (l1[44] !== " ") l1[43] = l1[44];
  l1[44] = ".";
  if (l1[7] === " ") l1[7] = "U";
  if (l1[9] === " ") l1[9] = ".";
  for (let j = 45; j <= 49; j++) if (l1[j] === " ") l1[j] = "0";
  if (l1[51] === " ") l1[51] = "0";
  if (l1[53] !== " ") l1[52] = l1[53];
  l1[53] = ".";
  l2[25] = ".";
  for (let j = 26; j <= 32; j++) if (l2[j] === " ") l2[j] = "0";
  if (l1[62] === " ") l1[62] = "0";
  if (l1[68] === " ") l1[68] = "0";
}

const XPDP = 1440.0 / (2.0 * Math.PI);

/**
 * Parse a TLE pair. With strict=true (default) a bad checksum throws.
 * VER-format line 2 may carry start/stop/delta after column 68.
 */
export function parseTle(raw1: string, raw2: string, opts: { strict?: boolean } = {}): TleElements {
  const strict = opts.strict ?? true;
  const c1 = tleChecksumOk(raw1);
  const c2 = tleChecksumOk(raw2);
  if (strict && (!c1 || !c2)) {
    throw new Error(`sgp4: TLE checksum failed (l1=${c1} l2=${c2})`);
  }
  const l1 = raw1.split("");
  const l2 = raw2.split("");
  surgery(l1, l2);

  const s1: Scanner = { s: l1.join(""), i: 0 };
  scanInt(s1, 2); // cardnumb
  const satnum = scanChars(s1, 5);
  const classification = scanRaw(s1, 1);
  const intldesg = scanChars(s1, 10);
  const epochyr = scanInt(s1, 2);
  const epochdays = scanFloat(s1, 12);
  const ndot = scanFloat(s1, 11);
  const nddot = scanFloat(s1, 7);
  const nexp = scanInt(s1, 2);
  const bstar = scanFloat(s1, 7);
  const ibexp = scanInt(s1, 2);
  const ephtype = scanInt(s1, 2);
  const elnum = scanInt(s1, 6);

  const s2: Scanner = { s: l2.join(""), i: 0 };
  scanInt(s2, 2);
  scanChars(s2, 5);
  const inclo = scanFloat(s2, 9);
  const nodeo = scanFloat(s2, 9);
  const ecco = scanFloat(s2, 8);
  const argpo = scanFloat(s2, 9);
  const mo = scanFloat(s2, 9);
  let noKozai: number;
  if (l2[52] === " ") noKozai = scanFloat(s2, 10);
  else noKozai = scanFloat(s2, 11);
  const revnum = scanInt(s2, 6);
  let startmfe: number | null = null;
  let stopmfe: number | null = null;
  let deltamin: number | null = null;
  const rest = s2.s.slice(s2.i).trim();
  if (rest.length > 0) {
    const parts = rest.split(/\s+/).map(Number);
    if (parts.length >= 3 && parts.every(Number.isFinite)) {
      startmfe = parts[0];
      stopmfe = parts[1];
      deltamin = parts[2];
    }
  }

  return {
    satnum, classification, intldesg, epochyr, epochdays,
    ndot, nddot, nexp, bstar, ibexp, ephtype, elnum,
    inclo, nodeo, ecco, argpo, mo, noKozai, revnum,
    startmfe, stopmfe, deltamin,
    checksumOk1: c1, checksumOk2: c2,
  };
}

export interface TwolineResult {
  satrec: ElsetRec;
  startmfe: number | null;
  stopmfe: number | null;
  deltamin: number | null;
}

/**
 * twoline2rv equivalent: parse + unit conversion + jd + sgp4init.
 * whichconst 'wgs72' matches the official verification runs.
 */
export function twoline2rv(
  line1: string,
  line2: string,
  whichconst: GravConstKind,
  opsmode: string,
  opts: { strict?: boolean } = {},
): TwolineResult {
  const deg2rad = Math.PI / 180.0;
  const el = parseTle(line1, line2, opts);
  const satrec = newElsetRec();
  satrec.satnum = el.satnum;

  satrec.noKozai = el.noKozai / XPDP;
  satrec.nddot = el.nddot * Math.pow(10.0, el.nexp);
  satrec.bstar = el.bstar * Math.pow(10.0, el.ibexp);
  satrec.ndot = el.ndot / (XPDP * 1440.0);
  satrec.nddot = satrec.nddot / (XPDP * 1440.0 * 1440.0);
  satrec.inclo = el.inclo * deg2rad;
  satrec.nodeo = el.nodeo * deg2rad;
  satrec.argpo = el.argpo * deg2rad;
  satrec.mo = el.mo * deg2rad;
  satrec.classification = el.classification;
  satrec.intldesg = el.intldesg;
  satrec.ephtype = el.ephtype;
  satrec.elnum = el.elnum;
  satrec.revnum = el.revnum;

  const year = el.epochyr < 57 ? el.epochyr + 2000 : el.epochyr + 1900;
  const md = days2mdhms(year, el.epochdays);
  const jd = jday(year, md.mon, md.day, md.hr, md.minute, md.sec);
  satrec.jdsatepoch = jd.jd;
  satrec.jdsatepochF = jd.jdFrac;

  sgp4init(
    {
      whichconst, opsmode, satn: el.satnum,
      epoch: satrec.jdsatepoch + satrec.jdsatepochF - 2433281.5,
      xbstar: satrec.bstar, xndot: satrec.ndot, xnddot: satrec.nddot,
      xecco: el.ecco, xargpo: satrec.argpo, xinclo: satrec.inclo,
      xmo: satrec.mo, xnoKozai: satrec.noKozai, xnodeo: satrec.nodeo,
    },
    satrec,
  );

  return { satrec, startmfe: el.startmfe, stopmfe: el.stopmfe, deltamin: el.deltamin };
}
