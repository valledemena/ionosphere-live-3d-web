import { NextResponse } from "next/server";
import {
  cacheable,
  filterFresh,
  isCacheUsable,
  parseKc2gRow,
  resolveSource,
  type Kc2gStation,
} from "@/lib/iono/fallback";

/**
 * GIRO/DIDBase: catálogo de estaciones + datos recientes por estación.
 *
 * Estrategia (evitando el POST masivo del C++ original, prohibido en serverless):
 *   1. Catálogo:  https://lgdc.uml.edu/common/DIDBFastStationList?orderByField=ursiCode (regex)
 *   2. Datos:     https://lgdc.uml.edu/fastchar/getbest?ursiCode=XXX&charName=foF2&fromDate=...&toDate=...
 *      -> Endpoint GET rápido por estación (el mismo que expone DIDBase).
 *      Consultamos en paralelo un subconjunto (~28 estaciones estratégicas globales)
 *      con cadencia de 10 min en el server, incluyendo historia (para replay).
 *
 * W-4 244 (ruling 243, resiliencia): fail-fast + kc2g FAILOVER-ONLY +
 * caché honesta. Precedencia live > kc2g > cache > model, declarada en
 * el payload (source dinámico, nunca constante).
 *
 * Caché: 10 min (solo no-vacía). El cliente puede pedir ?full=1 para todas
 * las estaciones con dato. Catálogo: TTL 24 h (antes nunca expiraba).
 * Anti-rebaño: tras fallo total LGDC se sirve fallback 5 min sin reintentar.
 */

export const revalidate = 0;

const UA = "IonosphereLive3D-Web/1.0 (exploration demo)";
const CATALOG_URL = "https://lgdc.uml.edu/common/DIDBFastStationList?orderByField=ursiCode";
const GETBEST = "https://lgdc.uml.edu/fastchar/getbest";

/** 50 estaciones verificadas del catálogo GIRO (cobertura global, EB040 incluida) */
const CORE_STATIONS = [
  "EB040", // Roquetes, España (¡la del autor!)
  "EA036", // El Arenosillo, España
  "PQ052", "JR055", "KL154", "KI167", "FF051", "GM037", "AT138",
  "VT139", "OL246", "LD160", "MZ152", "RV149", "TR170", "RL052",
  "SO148", "TR169", "DB049", "EG931", "CS839", "BC840", "AC843",
  "EI764", "PF765", "AU930", "BVJ03", "SMK29", "TNJ20", "CAJ2M",
  "CXM9B", "BLJ03", "LA42Q", "DW41K", "CB53N", "TO535", "IC437",
  "DH224", "NI135", "XI434", "CS31K", "TV51R", "MA155", "MO155",
  "ML10L", "GR13L", "MU12K", "RM041", "NDA81", "TR0P2",
];

const uniq = Array.from(new Set(CORE_STATIONS));

interface StationInfo {
  code: string;
  name: string;
  lat: number;
  lon: number;
}

interface StationData {
  code: string;
  foF2: number | null;
  muf3000: number | null;
  history: { t: string; foF2: number }[];
  // Caracteristicas extra (W-3 rejilla; null = ausente -> puertas >0 del oraculo).
  foE: number | null;
  foF1: number | null;
  hmF2: number | null;
  B0: number | null;
  B1: number | null;
}

/**
 * ESTRATEGIA DECLARADA de caracteristicas extra (P1-170): el endpoint
 * getbest acepta UN solo charName por llamada y LGDC limita agresivo (429
 * verificado en vivo) -> por-parametro, NO charName multiple. Para no
 * multiplicar x6 el ciclo de 50 estaciones: 12 ANCLAS fijas (determinista;
 * la cobertura la completan el IDW-50 grados + fondo de modelo del oraculo)
 * con TTL propio de 60 min (E/F1/B0/B1 evolucionan lento; en estable el
 * coste extra es 0) y ventana corta (65 min, ~13 filas). El refresco horario
 * anade ~1 lote con la misma cortesia (6 workers, 250 ms). Si falla, se
 * conserva la cache previa (best-effort: nunca vacia el ciclo).
 */
const EXTRA_CHARS = ["foE", "foF1", "hmF2", "B0", "B1"] as const;
const ANCHOR_STATIONS = [
  "EB040", "JR055", "PQ052", "FF051", "BC840", "TO535",
  "PF765", "BVJ03", "RL052", "AU930", "AT138", "TR170",
];
const EXTRA_TTL_MS = 3600_000;

let stationCache: { data: unknown; ts: number } | null = null;
let catalogCache: { data: StationInfo[]; ts: number } | null = null;
let extraCache: { data: Map<string, Record<string, number | null>>; ts: number } | null = null;
// W-4 244: anti-rebaño LGDC (timestamp hasta el que se sirve fallback directo).
let lgdcDownUntil = 0;
const CATALOG_TTL_MS = 24 * 3600_000;
const DOWN_TTL_MS = 5 * 60_000;
const KC2G_URL = "https://prop.kc2g.com/api/stations.json";

function parseCatalog(html: string): StationInfo[] {
  const out: StationInfo[] = [];
  const re =
    /ursiCode=([A-Z0-9]{5})">[^<]*<\/a><\/big><\/td><td[^>]*><big>([^<]*)<\/big><\/td><td[^>]*><big>\s*(-?[0-9.]+)<\/big><\/td><td[^>]*><big>\s*(-?[0-9.]+)<\/big><\/td>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const code = m[1];
    const name = m[2].replace(/\t/g, " ").replace(/\s+/g, " ").trim();
    const lat = parseFloat(m[3]);
    let lon = parseFloat(m[4]);
    if (lon > 180) lon -= 360;
    if (isFinite(lat) && isFinite(lon)) out.push({ code, name, lat, lon });
  }
  return out;
}

async function fetchCatalog(): Promise<StationInfo[]> {
  if (catalogCache && Date.now() - catalogCache.ts < CATALOG_TTL_MS) return catalogCache.data;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(CATALOG_URL, {
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const html = await res.text();
    catalogCache = { data: parseCatalog(html), ts: Date.now() };
    return catalogCache.data;
  } catch {
    return [];
  }
}

function parseGetBest(text: string): StationData | null {
  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));
  const codeMatch = text.match(/URSI-Code\s+([A-Z0-9]{5})/);
  const code = codeMatch ? codeMatch[1] : "";
  const mufMatch = text.match(/DMUF=3000\s*:\s*([0-9.]+)/);
  const muf3000 = mufMatch ? parseFloat(mufMatch[1]) : null;
  const history: { t: string; foF2: number }[] = [];
  let foF2: number | null = null;
  for (const l of lines) {
    if (!l || l.startsWith("#") || l.startsWith("Time")) continue;
    const toks = l.trim().split(/\s+/);
    if (toks.length < 3) continue;
    const t = toks[0];
    const fo = parseFloat(toks[2]);
    if (!isFinite(fo)) continue;
    history.push({ t, foF2: fo });
  }
  if (history.length) {
    // último valor con CS>0 preferido; si no, el último
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].foF2 > 0) {
        foF2 = history[i].foF2;
        break;
      }
    }
  }
  if (!code) return null;
  // W-4 C1: ventana 168 h (app kIrtamReplayWindowSec); LGDC devuelve serie
  // dispersa (~15 ionogramas/día), no cadencia fija: cap 2500 de sobra.
  return { code, foF2, muf3000, history: history.slice(-2500), foE: null, foF1: null, hmF2: null, B0: null, B1: null };
}

/**
 * Ultimo valor >0 de una caracteristica (misma regla que foF2: ultimo
 * positivo; formato Time CS <char> QD por caracteristica).
 */
function parseCharValue(text: string): number | null {
  const lines = text.split("\n").map((l) => l.replace(/\r$/, ""));
  const vals: number[] = [];
  for (const l of lines) {
    if (!l || l.startsWith("#") || l.startsWith("Time")) continue;
    const toks = l.trim().split(/\s+/);
    if (toks.length < 3) continue;
    const v = parseFloat(toks[2]);
    if (isFinite(v)) vals.push(v);
  }
  for (let i = vals.length - 1; i >= 0; i--) {
    if (vals[i] > 0) return vals[i];
  }
  return null;
}

async function fetchChar(
  code: string,
  charName: string,
  from: Date,
  now: Date
): Promise<number | null> {
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(
      d.getUTCDate()
    ).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}:${String(
      d.getUTCMinutes()
    ).padStart(2, "0")}:00`;
  const url = `${GETBEST}?ursiCode=${code}&charName=${charName}&fromDate=${fmt(from)}&toDate=${fmt(now)}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    if (text.includes("STATUS: ERROR")) return null;
    return parseCharValue(text);
  } catch {
    return null;
  }
}

async function fetchStation(code: string, now: Date): Promise<StationData | null> {
  // W-4 C1: 168 h de historia (era 6 h) para el replay largo del app.
  const from = new Date(now.getTime() - 168 * 3600_000);
  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(
      d.getUTCDate()
    ).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}:${String(
      d.getUTCMinutes()
    ).padStart(2, "0")}:00`;
  const url = `${GETBEST}?ursiCode=${code}&charName=foF2&fromDate=${fmt(from)}&toDate=${fmt(now)}`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const text = await res.text();
    if (text.includes("STATUS: ERROR")) return null;
    return parseGetBest(text);
  } catch {
    return null;
  }
}

/** kc2g FAILOVER-ONLY (FASE A): 1 GET por ciclo, solo con ronda fallida. */
async function fetchKc2g(now: Date): Promise<Kc2gStation[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(KC2G_URL, {
      headers: { "User-Agent": UA },
      signal: ctrl.signal,
      next: { revalidate: 0 },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const json: unknown = await res.json();
    if (!Array.isArray(json)) return [];
    const out: Kc2gStation[] = [];
    for (const row of json) {
      const s = parseKc2gRow(row);
      if (s) out.push(s);
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantFull = url.searchParams.get("full") === "1";
  const cacheOk = stationCache && Date.now() - stationCache.ts < 600_000 && !wantFull;

  if (cacheOk && stationCache) {
    return NextResponse.json(stationCache.data, {
      headers: { "Cache-Control": "no-store", "X-Cache": "hit" },
    });
  }

  const now = new Date();
  const lgdcDown = Date.now() < lgdcDownUntil;
  const catalog = lgdcDown ? [] : await fetchCatalog();

  // Ronda LGDC con fail-fast: primera ola de 6; cero aciertos -> abortar
  // resto + extras (respuesta en segundos, no minutos).
  const results: StationData[] = [];
  let roundOk = false;
  if (catalog.length && !wantFull) {
    const codes = uniq;
    const queue = [...codes];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let hits = 0;
    let processed = 0;
    const firstWave = Math.min(6, queue.length);
    async function worker() {
      while (queue.length) {
        // fail-fast: tras la primera ola sin aciertos, parar.
        if (processed >= firstWave && hits === 0) return;
        const code = queue.shift()!;
        processed++;
        const d = await fetchStation(code, now);
        if (d && (d.foF2 !== null || d.history.length)) {
          results.push(d);
          hits++;
        }
        await sleep(250); // cortesía con LGDC (rate-limit 429)
      }
    }
    await Promise.all(Array.from({ length: 6 }, () => worker()));
    roundOk = hits > 0;
  } else if (wantFull) {
    const codes = catalog.slice(0, 80).map((s) => s.code);
    const queue = [...codes];
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    async function worker() {
      while (queue.length) {
        const code = queue.shift()!;
        const d = await fetchStation(code, now);
        if (d && (d.foF2 !== null || d.history.length)) results.push(d);
        await sleep(250);
      }
    }
    await Promise.all(Array.from({ length: 6 }, () => worker()));
    roundOk = results.length > 0;
  }

  // Caracteristicas extra para anclas (TTL propio; best-effort con fallback
  // a la cache previa para no vaciar el ciclo si LGDC limita). Solo con
  // ronda viva (con ronda cero no corren: fail-fast).
  if (!wantFull && roundOk && (!extraCache || Date.now() - extraCache.ts >= EXTRA_TTL_MS)) {
    try {
      const fromX = new Date(now.getTime() - 65 * 60_000);
      const xqueue: { code: string; char: string }[] = [];
      for (const code of ANCHOR_STATIONS) for (const char of EXTRA_CHARS) xqueue.push({ code, char });
      const xresults = new Map<string, Record<string, number | null>>();
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      async function xworker() {
        while (xqueue.length) {
          const job = xqueue.shift()!;
          const v = await fetchChar(job.code, job.char, fromX, now);
          if (v !== null) {
            let rec = xresults.get(job.code);
            if (!rec) {
              rec = {};
              xresults.set(job.code, rec);
            }
            rec[job.char] = v;
          }
          await sleep(250);
        }
      }
      await Promise.all(Array.from({ length: 6 }, () => xworker()));
      if (xresults.size) extraCache = { data: xresults, ts: Date.now() };
    } catch {
      // conserva la cache previa (o nulos si nunca hubo)
    }
  }
  const extras = extraCache?.data ?? new Map<string, Record<string, number | null>>();

  const byCode = new Map(catalog.map((s) => [s.code, s]));
  const live = results
    .map((d) => {
      const info = byCode.get(d.code);
      const x = extras.get(d.code) ?? {};
      const lastT = d.history.length ? d.history[d.history.length - 1].t : null;
      return {
        code: d.code,
        name: info?.name ?? d.code,
        lat: info?.lat ?? 0,
        lon: info?.lon ?? 0,
        foF2: d.foF2,
        muf3000: d.muf3000,
        history: d.history,
        foE: x.foE ?? null,
        foF1: x.foF1 ?? null,
        hmF2: x.hmF2 ?? null,
        B0: x.B0 ?? null,
        B1: x.B1 ?? null,
        // stale por edad (>6 h fuera de mapas); paneles intactos.
        stale: lastT ? now.getTime() - Date.parse(lastT) > 6 * 3600_000 : false,
      };
    })
    .filter((s) => s.lat !== 0 || s.lon !== 0 || s.foF2 !== null)
    .sort((a, b) => a.code.localeCompare(b.code));

  // Fallback kc2g (solo con ronda fallida): panel <=24 h, grids via stale.
  let kc2gCount = 0;
  let stations = live;
  if (!wantFull && live.length === 0) {
    const kc = await fetchKc2g(now);
    const fresh24 = filterFresh(kc, now.getTime(), 24 * 3600_000);
    kc2gCount = fresh24.length;
    stations = fresh24
      .map((s) => ({
        code: s.code,
        name: s.name,
        lat: s.lat,
        lon: s.lon,
        foF2: s.foF2,
        muf3000: s.mufd,
        history: [] as { t: string; foF2: number }[],
        foE: s.foE,
        foF1: s.foF1,
        hmF2: s.hmF2,
        B0: 100,
        B1: 3,
        stale: now.getTime() - s.timeMs > 6 * 3600_000,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }

  // Precedencia + caché honesta (nunca vacío como bueno).
  const cacheAgeMin =
    stationCache && (stationCache.data as { stations?: unknown[] }).stations?.length
      ? Math.round((Date.now() - stationCache.ts) / 60000)
      : null;
  const kind = resolveSource({ live: live.length, kc2g: kc2gCount, cacheAgeMin });
  const source =
    kind === "live"
      ? "GIRO DIDBase (live, getbest)"
      : kind === "kc2g"
        ? "kc2g fallback"
        : kind === "cache" && cacheAgeMin !== null
          ? `cache +${cacheAgeMin}min`
          : "model";

  let data: unknown;
  if (stations.length > 0) {
    data = {
      updated: Date.now(),
      stations,
      total: stations.length,
      catalogSize: catalog.length,
      source,
    };
  } else if (isCacheUsable(cacheAgeMin) && stationCache) {
    // P1-245b: el payload caché porta el source NUEVO (no el viejo).
    data = { ...(stationCache.data as Record<string, unknown>), source };
  } else {
    data = {
      updated: Date.now(),
      stations: [],
      total: 0,
      catalogSize: catalog.length,
      source: "model",
    };
  }

  // Anti-rebaño: fallo total LGDC -> servir fallback 5 min sin reintentar.
  if (!wantFull && !roundOk && catalog.length === 0) {
    lgdcDownUntil = Date.now() + DOWN_TTL_MS;
  }

  // no cachear el modo full tan agresivo (diagnóstico); nunca vacío bueno.
  if (!wantFull && cacheable(stations.length)) {
    stationCache = { data, ts: Date.now() };
  }
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store", "X-Cache": "miss" } });
}
