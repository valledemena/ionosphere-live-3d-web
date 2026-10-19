/**
 * W-4 #1 CME con ETA ENLIL (ruling 252, oraculos O1.1-O1.5). Puro: sin DOM ni red.
 *
 * REFERENCIA PINEADA (regla 252, ANTES de codigo): la forma del dato es la
 * respuesta real de `GET https://ccmc.gsfc.nasa.gov/DONKI-API/get/WSAEnlilSimulations`
 * (verificada viva el 2026-10-14 desde el sandbox; la forma sin `/get/` da 404):
 *   [{ simulationID, modelCompletionTime, au, cmeInputs: [{ cmeStartTime,
 *      latitude, longitude, speed, halfAngle, time21_5, featureCode,
 *      isMostAccurate, CMEID, ... }], estimatedShockArrivalTime|null,
 *      estimatedDuration|null, isEarthGB, rmin_re, kp_90/135/180|null,
 *      impactList|null, link }]
 * La velocidad/direccion del evento (O1.4) salen de los cmeInputs de la
 * propia simulacion (entrada isMostAccurate) — sin segundo fetch a
 * CMEAnalysis: menos modos de fallo, misma fuente.
 *
 * Honestidad (O1.1): cero constantes de evento en el codigo; el reposo es
 * la ultima simulacion disponible con su marca temporal, o "sin datos".
 * El frente NO simula plasma: la posicion es el progreso lineal entre el
 * inicio (time21_5) y el ETA publicado por el CCMC (O1.5: el transito de
 * 1-3 dias se muestra acelerado con factor VISIBLE).
 */

export interface EnlilCmeInput {
  cmeStartTime: number | null; // ms
  time21_5: number | null; // ms (inicio del transito modelado)
  speed: number | null; // km/s
  halfAngle: number | null; // grados
  latitude: number | null;
  longitude: number | null;
  isMostAccurate: boolean;
  cmeId: string | null;
}

export interface EnlilSim {
  simulationId: string;
  modelCompletionTime: number | null; // ms
  estimatedShockArrivalTime: number | null; // ms (ETA ENLIL)
  estimatedDuration: number | null; // horas
  isEarthGB: boolean;
  kpMax: number | null; // max de kp_90/135/180 no nulos
  link: string | null;
  inputs: EnlilCmeInput[];
}

function toMs(v: unknown): number | null {
  if (typeof v !== "string" || !v) return null;
  // DONKI usa "2026-10-14T11:30Z" (sin segundos): Date lo acepta tal cual.
  const t = Date.parse(v.length === 16 ? v + ":00Z" : v);
  return Number.isFinite(t) ? t : null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}

/** Parseo defensivo de la respuesta DONKI (unknown -> []: O1.1 reposo). */
export function parseEnlilSims(raw: unknown): EnlilSim[] {
  if (!Array.isArray(raw)) return [];
  const out: EnlilSim[] = [];
  for (const s of raw) {
    if (s == null || typeof s !== "object") continue;
    const r = s as Record<string, unknown>;
    const inputs: EnlilCmeInput[] = [];
    if (Array.isArray(r.cmeInputs)) {
      for (const c of r.cmeInputs) {
        if (c == null || typeof c !== "object") continue;
        const d = c as Record<string, unknown>;
        inputs.push({
          cmeStartTime: toMs(d.cmeStartTime),
          time21_5: toMs(d.time21_5),
          speed: num(d.speed),
          halfAngle: num(d.halfAngle),
          latitude: num(d.latitude),
          longitude: num(d.longitude),
          isMostAccurate: d.isMostAccurate === true,
          cmeId: str(d.CMEID),
        });
      }
    }
    const kps = [num(r.kp_90), num(r.kp_135), num(r.kp_180)].filter(
      (v): v is number => v != null
    );
    out.push({
      simulationId: str(r.simulationID) ?? "",
      modelCompletionTime: toMs(r.modelCompletionTime),
      estimatedShockArrivalTime: toMs(r.estimatedShockArrivalTime),
      estimatedDuration: num(r.estimatedDuration),
      isEarthGB: r.isEarthGB === true,
      kpMax: kps.length ? Math.max(...kps) : null,
      link: str(r.link),
      inputs,
    });
  }
  return out;
}

export interface CmeEventSel {
  status: "event";
  simId: string;
  modelTime: number | null;
  start: number | null; // time21_5 de la entrada mas exacta (o cmeStartTime)
  arrival: number; // ETA ENLIL (ms)
  durationH: number | null;
  earthGB: boolean;
  speed: number | null;
  halfAngle: number | null;
  srcLat: number | null;
  srcLon: number | null;
  cmeId: string | null;
  kpMax: number | null;
  link: string | null;
}

export interface CmeQuietSel {
  status: "quiet";
  modelTime: number | null;
  simCount: number;
}

export interface CmeUnknownSel {
  status: "unknown";
}

export type CmeSelection = CmeEventSel | CmeQuietSel | CmeUnknownSel;

/**
 * Seleccion honesta (O1.1): la ultima simulacion (por modelCompletionTime)
 * CON ETA publicado. Sin ETA en ninguna -> quiet con la marca temporal de
 * la ultima disponible. Sin sims -> unknown (jamas evento ficticio).
 */
export function pickCmeEvent(sims: EnlilSim[]): CmeSelection {
  if (!sims.length) return { status: "unknown" };
  const byModel = [...sims].sort(
    (a, b) => (b.modelCompletionTime ?? 0) - (a.modelCompletionTime ?? 0)
  );
  for (const s of byModel) {
    if (s.estimatedShockArrivalTime == null) continue;
    const best = s.inputs.find((i) => i.isMostAccurate) ?? s.inputs[0] ?? null;
    return {
      status: "event",
      simId: s.simulationId,
      modelTime: s.modelCompletionTime,
      start: best?.time21_5 ?? best?.cmeStartTime ?? null,
      arrival: s.estimatedShockArrivalTime,
      durationH: s.estimatedDuration,
      earthGB: s.isEarthGB,
      speed: best?.speed ?? null,
      halfAngle: best?.halfAngle ?? null,
      srcLat: best?.latitude ?? null,
      srcLon: best?.longitude ?? null,
      cmeId: best?.cmeId ?? null,
      kpMax: s.kpMax,
      link: s.link,
    };
  }
  return {
    status: "quiet",
    modelTime: byModel[0].modelCompletionTime,
    simCount: sims.length,
  };
}

/**
 * Progreso del frente 0..1 (0 = Sol/inicio, 1 = Tierra/llegada). Sin
 * inicio conocido -> binario (0 antes, 1 despues): declarado, no inventado.
 */
export function cmeProgress(
  startMs: number | null,
  arrivalMs: number,
  nowMs: number
): number {
  if (startMs == null || !(arrivalMs > startMs)) return nowMs >= arrivalMs ? 1 : 0;
  if (nowMs <= startMs) return 0;
  if (nowMs >= arrivalMs) return 1;
  return (nowMs - startMs) / (arrivalMs - startMs);
}

/** Llegada consumada (para el encadenado O1.3). Pura. */
export function cmeArrived(
  startMs: number | null,
  arrivalMs: number,
  nowMs: number
): boolean {
  return cmeProgress(startMs, arrivalMs, nowMs) >= 1;
}

/** Cuenta atras honesta en ASCII (doctrina del canal). */
export function cmeCountdown(arrivalMs: number, nowMs: number): string {
  const d = arrivalMs - nowMs;
  if (Math.abs(d) < 60_000) return "ahora";
  const past = d < 0;
  const mins = Math.floor(Math.abs(d) / 60_000);
  const dd = Math.floor(mins / 1440);
  const hh = Math.floor((mins % 1440) / 60);
  const mm = mins % 60;
  const body =
    dd > 0 ? `${dd} d ${hh} h` : hh > 0 ? `${hh} h ${mm} min` : `${mm} min`;
  return past ? `llego hace ${body}` : `en ${body}`;
}

/**
 * Factor de aceleracion VISIBLE del barrido del transito (O1.5):
 * el transito real (start->arrival) comprimido a sweepMs milisegundos.
 */
export function lapseFactor(
  startMs: number | null,
  arrivalMs: number,
  sweepMs = 8000
): number {
  if (startMs == null || !(arrivalMs > startMs) || !(sweepMs > 0)) return 1;
  return Math.max(1, Math.round((arrivalMs - startMs) / sweepMs));
}

/**
 * Factor de compresion de DEMOSTRACION sobre la magnetopausa de #4 a la
 * llegada (O1.3). DECLARADO en UI y nota: el pronostico ENLIL no publica
 * Dp, asi que el encadenado usa este factor fijo y visible — no una
 * fisica simulada.
 */
export const CME_COMPRESSION_DEMO = 1.6;

/** Dp efectiva para #4: boost solo si la llegada ENLIL es geoefectiva. */
export function cmeEffectiveDp(
  dp: number,
  arrived: boolean,
  earthGB: boolean
): number {
  return arrived && earthGB ? dp * CME_COMPRESSION_DEMO : dp;
}
