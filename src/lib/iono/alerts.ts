/**
 * Motor de alertas de propagacion W-2 (spec del veredicto 152, P3).
 * Port fiel del motor C++ (drop 139, src/Data/Alerts.h): mismos umbrales
 * con nombre, rojo tras 2 muestras, anillo MUF 24 h con mediana, OFF
 * honesto, overall peor-sin-OFF, cola acotada de 32. Puro: sin DOM ni red.
 * La cola de eventos ES la cola que consumiria un hook de audio (modo demo).
 */
export enum AlertLevel {
  GREEN = 0,
  AMBER = 1,
  RED = 2,
  OFF = 3,
}

export enum AlertRule {
  KP = 0,
  BZ = 1,
  XRAY = 2,
  MUF = 3,
}
export const NRULES = 4;

// Umbrales del catalogo (constantes nombradas, identicas al C++ = defaults
// del drop 353; el motor ahora acepta umbrales rojos configurables).
export const KP_AMBER = 4.0;
export const KP_RED = 5.0;
export const BZ_AMBER = -5.0; // Bz sur negativo
export const BZ_RED = -10.0;
export const XRAY_AMBER_RANK = 2; // C
export const XRAY_RED_RANK = 3; // M
export const MUF_AMBER_DROP = 0.1; // vs mediana 24 h
export const MUF_RED_DROP = 0.2; // vs mediana 24 h
export const DEBOUNCE_N = 2; // muestras seguidas para rojo
export const MUF_HIST_MAX = 288; // 24 h a 5 min/muestra
export const MUF_MIN_SAMPLES = 6;
export const MUF_MIN_SPAN_SEC = 3 * 3600;
export const LOG_MAX = 32; // cola acotada en memoria

/** Solo umbrales ROJOS configurables (drop 353). Ámbar y debounce intactos. */
export interface AlertThresholds {
  kpRed: number; // 4..9, paso 0.5
  bzRed: number; // -30..-5, entero
  xrayRedRank: number; // 2..4 entero (C=2 M=3 X=4)
  mufRedDrop: number; // 0.10..0.50, paso 0.05
}

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  kpRed: KP_RED,
  bzRed: BZ_RED,
  xrayRedRank: XRAY_RED_RANK,
  mufRedDrop: MUF_RED_DROP,
};

const snap = (v: number, step: number, lo: number, hi: number): number => {
  const n = Math.round(v / step) * step;
  // evita float sucio: re-añade con 2 decimales maximos (pasos 0.5/0.05)
  return Math.min(hi, Math.max(lo, Math.round(n * 100) / 100));
};

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/**
 * Normaliza umbrales rojos de forma defensiva (drop 353): cualquier campo
 * ausente, NaN, string no numerico o fuera de rango cae al default del
 * catalogo. Puro.
 */
export function normalizeAlertThresholds(v: unknown): AlertThresholds {
  const o = (v ?? {}) as Partial<AlertThresholds>;
  const d = DEFAULT_ALERT_THRESHOLDS;
  const kp = isNum(o.kpRed) ? snap(o.kpRed, 0.5, 4, 9) : d.kpRed;
  const bz = isNum(o.bzRed) ? Math.min(-5, Math.max(-30, Math.round(o.bzRed))) : d.bzRed;
  const xr = isNum(o.xrayRedRank) ? Math.min(4, Math.max(2, Math.round(o.xrayRedRank))) : d.xrayRedRank;
  const muf = isNum(o.mufRedDrop) ? snap(o.mufRedDrop, 0.05, 0.1, 0.5) : d.mufRedDrop;
  return { kpRed: kp, bzRed: bz, xrayRedRank: xr, mufRedDrop: muf };
}

/** Rango NOAA de clase X-ray: A=0 B=1 C=2 M=3 X=4. */
export function xrayRank(c: string): number {
  if (c === "X") return 4;
  if (c === "M") return 3;
  if (c === "C") return 2;
  if (c === "B") return 1;
  return 0;
}

export interface AlertInput {
  kpOk: boolean;
  kp: number;
  bzOk: boolean;
  bz: number;
  xrayOk: boolean;
  xrayClass: string;
  mufOk: boolean;
  muf: number;
  utc: number; // tiempo de la muestra (s)
}

/** Vista minima del modelo space-weather para el contrato del wiring. */
export interface SwLike {
  kp: { now: number; source: string };
  wind: { bz: number; t: string | null };
  xray: { class: string };
}

// Em-dash que emite route.ts sin dato GOES, en escape para que las
// lineas anadidas sigan siendo 100% ASCII (doctrina EOL/ASCII del canal).
const XRAY_NO_DATA = "\u2014";

/**
 * Contrato del wiring (reparo n1 del veredicto 156 + P2 kpOk honesto):
 * el modelo web da clase letra+magnitud ("M5.0") o "\u2014" sin dato GOES,
 * mientras el motor espera 1 char como el fclass del C++. Se normaliza
 * aqui, no en el motor (que sigue fiel al oraculo). La mediana MUF es la
 * superior (vs[n/2]), igual que el nth_element mid del C++.
 */
export function buildAlertInput(
  sw: SwLike | null,
  mufs: (number | null | undefined)[],
  utc: number
): AlertInput {
  const cls = sw?.xray.class ?? "";
  const xOk = sw != null && cls !== "" && cls !== XRAY_NO_DATA;
  const sorted = mufs
    .filter((v): v is number => v != null && v > 0)
    .sort((a, b) => a - b);
  return {
    utc,
    kpOk: sw != null && sw.kp.source !== "unavailable",
    kp: sw?.kp.now ?? 0,
    bzOk: sw != null && sw.wind.t != null,
    bz: sw?.wind.bz ?? 0,
    xrayOk: xOk,
    xrayClass: cls.charAt(0),
    mufOk: sorted.length > 0,
    muf: sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0,
  };
}

export interface AlertEvent {
  utc: number;
  rule: number;
  from: AlertLevel;
  to: AlertLevel;
}

interface MufPt {
  utc: number;
  v: number;
}

export const RULE_NAMES = ["Kp", "Bz", "X-ray", "MUF drop"] as const;

/** Foto inmutable para el panel (el motor sigue vivo en el ref de pagina). */
export interface AlertSnapshot {
  overall: AlertLevel;
  levels: AlertLevel[];
  events: AlertEvent[];
}

export class AlertEngine {
  private levels: AlertLevel[] = [AlertLevel.OFF, AlertLevel.OFF, AlertLevel.OFF, AlertLevel.OFF];
  private redCount: number[] = [0, 0, 0, 0];
  private mufHist: MufPt[] = [];
  private lastMufUtc = 0;
  private log: AlertEvent[] = [];
  private th: AlertThresholds;

  constructor(thresholds?: AlertThresholds) {
    this.th = normalizeAlertThresholds(thresholds ?? DEFAULT_ALERT_THRESHOLDS);
  }

  /** Cambia umbrales rojos sin borrar historia/estado (drop 353). */
  setThresholds(t: AlertThresholds): void {
    this.th = normalizeAlertThresholds(t);
  }

  thresholds(): AlertThresholds {
    return { ...this.th };
  }

  /** Evalua una muestra (una publicacion de datos). Barata y pura. */
  evaluate(input: AlertInput): void {
    this.setRule(AlertRule.KP, input.kpOk ? this.rawKp(input.kp) : AlertLevel.OFF, input.utc);
    this.setRule(AlertRule.BZ, input.bzOk ? this.rawBz(input.bz) : AlertLevel.OFF, input.utc);
    this.setRule(
      AlertRule.XRAY,
      input.xrayOk ? this.rawXray(input.xrayClass) : AlertLevel.OFF,
      input.utc,
    );
    this.setRule(AlertRule.MUF, this.mufLevel(input), input.utc);
  }

  overall(): AlertLevel {
    let w = AlertLevel.GREEN;
    for (let r = 0; r < NRULES; r++) {
      if (this.levels[r] !== AlertLevel.OFF && this.levels[r] > w) w = this.levels[r];
    }
    return w;
  }

  level(rule: number): AlertLevel {
    return this.levels[rule];
  }

  events(): AlertEvent[] {
    return this.log;
  }

  mufSamples(): number {
    return this.mufHist.length;
  }

  private rawKp(kp: number): AlertLevel {
    return kp >= this.th.kpRed ? AlertLevel.RED : kp >= KP_AMBER ? AlertLevel.AMBER : AlertLevel.GREEN;
  }

  private rawBz(bz: number): AlertLevel {
    return bz <= this.th.bzRed ? AlertLevel.RED : bz <= BZ_AMBER ? AlertLevel.AMBER : AlertLevel.GREEN;
  }

  private rawXray(c: string): AlertLevel {
    const r = xrayRank(c);
    return r >= this.th.xrayRedRank ? AlertLevel.RED : r >= XRAY_AMBER_RANK ? AlertLevel.AMBER : AlertLevel.GREEN;
  }

  private setRule(r: number, raw: AlertLevel, utc: number): void {
    const cur = this.levels[r];
    let want: AlertLevel;
    if (raw === AlertLevel.OFF) {
      this.redCount[r] = 0;
      want = AlertLevel.OFF;
    } else if (raw === AlertLevel.RED) {
      // Antiparpadeo: el rojo exige DEBOUNCE_N muestras seguidas;
      // mientras cuenta se muestra ambar sin latchear rojo.
      if (cur === AlertLevel.RED || ++this.redCount[r] >= DEBOUNCE_N) want = AlertLevel.RED;
      else want = AlertLevel.AMBER;
    } else {
      this.redCount[r] = 0;
      want = raw;
    }
    if (want !== cur) {
      this.levels[r] = want;
      this.log.push({ utc, rule: r, from: cur, to: want });
      if (this.log.length > LOG_MAX) this.log.shift();
    }
  }

  private mufLevel(input: AlertInput): AlertLevel {
    if (input.mufOk && input.utc > this.lastMufUtc && input.muf > 0) {
      this.mufHist.push({ utc: input.utc, v: input.muf });
      this.lastMufUtc = input.utc;
      while (this.mufHist.length > MUF_HIST_MAX) this.mufHist.shift();
      while (this.mufHist.length > 0 && input.utc - this.mufHist[0].utc > 24 * 3600)
        this.mufHist.shift();
    }
    // Historia insuficiente -> deshabilitada y declarado (no alerta).
    if (this.mufHist.length < MUF_MIN_SAMPLES) return AlertLevel.OFF;
    if (this.mufHist[this.mufHist.length - 1].utc - this.mufHist[0].utc < MUF_MIN_SPAN_SEC)
      return AlertLevel.OFF;
    const vs = this.mufHist.map((p) => p.v).sort((a, b) => a - b);
    const med = vs[Math.floor(vs.length / 2)];
    if (!(med > 0) || !input.mufOk || !(input.muf > 0)) return AlertLevel.OFF;
    const drop = (med - input.muf) / med;
    if (drop >= this.th.mufRedDrop) return AlertLevel.RED;
    if (drop >= MUF_AMBER_DROP) return AlertLevel.AMBER;
    return AlertLevel.GREEN;
  }
}
