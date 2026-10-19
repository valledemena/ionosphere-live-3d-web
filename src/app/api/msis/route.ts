import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createMsisState, msisinit, type MsisState } from "@/lib/iono/msis/msisInit";
import {
  buildMsisGrid,
  msisPoint,
  msisGridStats,
  createGfnCache,
  type GfnCache,
} from "@/lib/iono/msis/msisGrid";

/**
 * W-4 F2b #9d: local NRLMSIS 2.1 thermosphere (Tn + mass density).
 * The physics runs HERE (parameter blob on disk, zero egress): every
 * value is computed live by the ported model, never mocked. Solar and
 * geomagnetic inputs are REFERENCE quiet defaults unless the caller
 * passes them explicitly (echoed back in `inputs`).
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;

const TTL = 300_000;
let cached: { key: string; data: unknown; ts: number } | null = null;

let msisState: MsisState | null = null;
let msisCache: GfnCache | null = null;

function msis(): { state: MsisState; cache: GfnCache } {
  if (!msisState || !msisCache) {
    const bytes = readFileSync(join(process.cwd(), "src", "lib", "iono", "msis", "msis21.parm"));
    const state = createMsisState();
    msisinit(state, {
      parmBytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    });
    msisState = state;
    msisCache = createGfnCache();
  }
  return { state: msisState, cache: msisCache };
}

function num(v: string | null, fallback: number): number {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const PROFILE_ALTS = [100, 200, 300, 400, 500, 600];

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const altKm = Math.min(600, Math.max(100, num(q.get("alt"), 300)));
  const lat = Math.min(90, Math.max(-90, num(q.get("lat"), 0)));
  const lon = num(q.get("lon"), 0);
  const epochSec = num(q.get("epoch"), Math.floor(Date.now() / 1000));
  const day = new Date(epochSec * 1000);
  const doy =
    Math.floor((Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) -
      Date.UTC(day.getUTCFullYear(), 0, 1)) / 86400000) + 1;
  const utsec = day.getUTCHours() * 3600 + day.getUTCMinutes() * 60 + day.getUTCSeconds();
  const f107a = num(q.get("f107a"), 150);
  const f107 = num(q.get("f107"), 150);
  const apDaily = num(q.get("ap"), 4);
  const gw = Math.min(36, Math.max(4, Math.round(num(q.get("gw"), 24))));
  const gh = Math.min(18, Math.max(3, Math.round(num(q.get("gh"), 12))));
  const referenceDefaults = q.get("f107a") == null && q.get("f107") == null && q.get("ap") == null;

  const key = [altKm, lat, lon, doy, utsec, f107a, f107, apDaily, gw, gh].join("|");
  if (cached && cached.key === key && Date.now() - cached.ts < TTL) {
    return NextResponse.json(cached.data, { headers: { "Cache-Control": "no-store", "X-Cache": "hit" } });
  }

  const { state, cache } = msis();
  const ap = [apDaily, 0, 0, 0, 0, 0, 0];
  const point = msisPoint(state, cache, {
    w: 1, h: 1, altKm, doy, utsec, lat, lon, f107a, f107, ap,
  });
  const profile = PROFILE_ALTS.map((a) => {
    const p = msisPoint(state, cache, {
      w: 1, h: 1, altKm: a, doy, utsec, lat, lon, f107a, f107, ap,
    });
    return { altKm: a, tn: p.tn, rho: p.rho };
  });
  const grid = buildMsisGrid(state, cache, {
    w: gw, h: gh, altKm, doy, utsec, f107a, f107, ap,
  });
  const stats = msisGridStats(grid);
  const payload = {
    point: { altKm, lat, lon, tn: point.tn, rho: point.rho },
    profile,
    grid: {
      w: gw, h: gh, altKm,
      tnMin: stats.tnMin, tnMax: stats.tnMax, tnMean: stats.tnMean,
      rhoMin: stats.rhoMin, rhoMax: stats.rhoMax, rhoMean: stats.rhoMean,
    },
    inputs: { doy, utsec, epochSec, f107a, f107, apDaily, referenceDefaults },
    source: "NRLMSIS 2.1 port (local model, non-commercial research)",
  };
  cached = { key, data: payload, ts: Date.now() };
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
}
