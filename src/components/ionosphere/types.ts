/** Tipos compartidos cliente (espejo de las APIs) */

export interface KpPoint {
  t: number;
  kp: number;
}

export interface SpaceWeatherData {
  updated: number;
  utc: string;
  kp: { now: number; gScale: number; series: KpPoint[]; source: string };
  f107: { now: number; series: { t: number; f: number }[]; source: string };
  wind: { speed: number; bt: number; bz: number; bx: number; density: number; t: string | null; source: string };
  // W-4 F2b #12: Bx 1-min 3 h (polaridad de sector, O12).
  mag: { series: { t: number; bx: number }[]; source: string };
  xray: { now: number; class: string; series: { t: number; f: number }[]; seriesDay: { t: number; f: number }[]; source: string };
  // W-4 F2a #2: protones integrales GOES-18 (verdad de entrada PCA, O2).
  protons: { now: number; series: { t: number; f: number }[]; satellite: number; source: string };
  sunspots: {
    regions: { region: number; lat: number; lon: number; loc: string }[];
    source: string;
  };
  forecast: { maxKp: number | null; note: string; source: string };
}

export interface AuroraCell {
  lat: number;
  lon: number;
  p: number; // 0-100
}

export interface AuroraData {
  updated: number;
  observationTime: string;
  forecastTime: string;
  cells: AuroraCell[];
  source: string;
}

export interface CmeEventData {
  simId: string;
  modelTime: number | null;
  start: number | null; // time21_5 (inicio del transito modelado)
  arrival: number; // ETA ENLIL (ms)
  durationH: number | null;
  earthGB: boolean;
  speed: number | null; // km/s (entrada isMostAccurate)
  halfAngle: number | null; // grados
  srcLat: number | null;
  srcLon: number | null;
  cmeId: string | null;
  kpMax: number | null;
  link: string | null;
}

/** Espejo del payload de /api/cme (W-4 #1, ruling 252). */
export interface CmeData {
  status: "event" | "quiet" | "unknown";
  event: CmeEventData | null;
  modelTime: number | null;
  simCount: number;
  checkedAt: number;
  source: string;
}

/** Espejo del payload de /api/flares (W-4 #3, ruling 252). */
export interface FlareEventData {
  flrId: string;
  begin: number | null;
  peak: number | null;
  end: number | null;
  classType: string | null;
  srcLoc: string | null;
  ar: number | null;
  link: string | null;
}

export interface FlareData {
  flares: FlareEventData[];
  checkedAt: number;
  source: string;
}

/** Espejo del payload de /api/wspr (W-4 #5, ruling 252). */
export interface WsprSpotData {
  tx: string;
  rx: string;
  freq: number;
  band: string;
  snr: number;
  t: number;
  txLat: number;
  txLon: number;
  rxLat: number;
  rxLon: number;
  km: number;
}

export interface WsprData {
  spots: WsprSpotData[];
  fetchedAt: number;
  source: string;
}

/** Espejo del payload de /api/lightning (W-4 F2a #8, ruling 266). */
export interface LightningGranule {
  sat: string;
  start: number;
  end: number;
  size: number;
}

export interface StormCellData {
  id: string;
  lat: number;
  lon: number;
  area: string;
  onset: number | null;
  ends: number | null;
}

export interface LightningData {
  granules: LightningGranule[];
  storms: StormCellData[];
  checkedAt: number;
  source: string;
}

/** Espejo del payload de /api/ae (W-4 F2a #17, ruling 266). */
export interface AeData {
  now: number;
  max24h: number;
  series: { t: number; ae: number }[];
  count: number;
  checkedAt: number;
  // P1-279: edad del ultimo dato (lag documentado de Kyoto).
  ageDays: number;
  latestDate: string | null;
  source: string;
}

/** Espejo del payload de /api/dst (W-4 F2a #18, ruling 266). */
export interface DstStormData {
  id: string;
  start: number | null;
  kpMax: number | null;
  link: string | null;
}

export interface DstData {
  now: number;
  min7d: number;
  series: { t: number; dst: number }[];
  count: number;
  gst: DstStormData[];
  checkedAt: number;
  source: string;
}

/** Espejo del payload de /api/rbe (W-4 F2a #19, ruling 266). */
export interface RbeEventData {
  id: string;
  time: number | null;
  instrument: string | null;
  link: string | null;
}

export interface RbeData {
  events: RbeEventData[];
  checkedAt: number;
  source: string;
}

/** Espejo del payload de /api/voyager (W-4 F2b #7, ruling 288). */
export interface VoyagerData {
  au: number | null;
  date: string | null;
  lightHours: number | null;
  prW: number | null;
  checkedAt: number;
  source: string;
}

/** Espejo del payload de /api/msis (W-4 F2b #9d: Tn/rho locales). */
export interface MsisProfileRow {
  altKm: number;
  tn: number;
  rho: number;
}
export interface MsisData {
  point: { altKm: number; lat: number; lon: number; tn: number; rho: number };
  profile: MsisProfileRow[];
  grid: {
    w: number; h: number; altKm: number;
    tnMin: number; tnMax: number; tnMean: number;
    rhoMin: number; rhoMax: number; rhoMean: number;
  };
  inputs: {
    doy: number; utsec: number; epochSec: number;
    f107a: number; f107: number; apDaily: number; referenceDefaults: boolean;
  };
  source: string;
}

export interface StationHistoryPoint {
  t: string; // ISO
  foF2: number;
}

export interface IonosondeStation {
  code: string;
  name: string;
  lat: number;
  lon: number;
  foF2: number | null;
  muf3000: number | null;
  history: StationHistoryPoint[];
  // Caracteristicas extra W-3 (anclas; null = ausente -> fondo del oraculo).
  foE: number | null;
  foF1: number | null;
  hmF2: number | null;
  B0: number | null;
  B1: number | null;
  // W-4 244: stale declarado por la ruta (paneles intactos, grids excluyen).
  stale: boolean;
}

export interface IonosondeData {
  updated: number;
  stations: IonosondeStation[];
  total: number;
  catalogSize: number;
  source: string;
}

export interface SceneSettings {
  clouds: boolean;
  atmoQuality: "low" | "medium" | "high";
  showAurora: boolean;
  showShell: boolean;
  showStations: boolean;
  showRings: boolean;
  showLink: boolean;
  showGodrays: boolean; // pase post-ACES (W-3 P1-177, default ON productivo)
  showVolume: boolean; // raymarch Ne (W-3 P2-182, default OFF como el oraculo)
  exaggeration: number; // 1..5
  shellOpacity: number; // 0..1
  nightLights: number; // 0..1
  cinema: boolean;
  timeMode: "live" | "replay";
  replayMinutes: number; // 0..10080 (168 h de historia GIRO, W-4 C1)
  // W-4 C2: reproducción automática (espejo replayPlaying/Speed/loop).
  replayPlaying: boolean;
  replaySpeed: number; // 0.5..8 (x20 min/s a 1x, como App.cpp +dt*speed*1200s)
  replayLoop: boolean; // al llegar al presente, salto a -168 h
  // W-4 B1 slice QTH-DX: cortina Ne(h) (espejo SliceLayer + App.cpp:4245).
  showSlice: boolean;
  sliceSrc: "link" | "manual" | "fixed";
  sliceLatA: number;
  sliceLonA: number;
  sliceLatB: number;
  sliceLonB: number;
  // W-4 F1: iso-bands + etiquetas (espejo App.cpp:4230-4236).
  showIso: boolean;
  showLabels: boolean;
  // W-4 F2: modo Chapman + escala de opacidad (App.cpp:4219-4227).
  volumeMode: "density" | "chapman";
  volumeOpacity: number; // 0..2.5 UI, clamp [0,3]
  // W-4 #4 Magnetosfera v1 (ruling 252; default OFF: la burbuja enana el globo).
  showMagnetosphere: boolean;
  // W-4 #1 CME ENLIL (ruling 252; default ON: tablero + encadenado O1.3).
  showCme: boolean;
  // W-4 #3 flare->SID (ruling 252; default ON: solo arde con >= M1 real).
  showFlare: boolean;
  // W-4 #5 WSPRnet (ruling 252; default ON: arcos sutiles, techo 40).
  showWspr: boolean;
  // W-4 #6 grey line (ruling 252; default ON: subtle overlay).
  showGreyline: boolean;
  // W-4 F2a #2 fadeout global (ruling 266; default ON: quiet = invisible).
  showFadeout: boolean;
  // W-4 F2a #8 lightning+whistlers (ruling 266; default ON: subtle).
  showLightning: boolean;
  // W-4 F2a #17 electrojets (ruling 266; default ON: quiet = dim blue).
  showAe: boolean;
  // W-4 F2a #18 Dst ring (ruling 266; default ON: quiet = dim).
  showDst: boolean;
  // W-4 F2a #19 Van Allen (ruling 266; default ON: subtle tori).
  showBelts: boolean;
  // W-4 F2b #10 eco orbital 2026 (ruling 320; default ON: catalogo vivo
  // propagado con sgp4 en el cliente, con init troceada + barridos).
  showSatellites: boolean;
  // W-4 F2b #10 anillo West Ford 1963 (ruling 320; default ON: banda de
  // particulas DECLARADA como reconstruccion, sin datos vivos).
  showRing1963: boolean;
  // W-4 E-tail o6: tamaño de punto (App.cpp:4293 SliderFloat 3-30).
  // Adaptación declarada: slider web 3-15 (más allá satura el techo GL).
  pointSize: number; // 3..15 UI, default 11
}

export const DEFAULT_SETTINGS: SceneSettings = {
  clouds: true,
  atmoQuality: "high",
  showAurora: true,
  showShell: true,
  showStations: true,
  showRings: true,
  showLink: true,
  showGodrays: true,
  showVolume: false,
  exaggeration: 2.2,
  shellOpacity: 0.85,
  nightLights: 0.45,
  cinema: true,
  timeMode: "live",
  replayMinutes: 0,
  replayPlaying: false,
  replaySpeed: 2,
  replayLoop: true,
  showSlice: false,
  sliceSrc: "link",
  sliceLatA: 40,
  sliceLonA: -4,
  sliceLatB: 40,
  sliceLonB: -100,
  showIso: false,
  showLabels: false,
  volumeMode: "density",
  volumeOpacity: 1.0,
  pointSize: 11,
  showMagnetosphere: false,
  showCme: true,
  showFlare: true,
  showWspr: true,
  showGreyline: true,
  showFadeout: true,
  showLightning: true,
  showAe: true,
  showDst: true,
  showBelts: true,
  showSatellites: true,
  showRing1963: true,
};

/** Avance de replay en minutos-atrás (espejo App.cpp:2139-2141).
 * 0 = presente; avanza el epoch (+dt*speed*1200 s) y envuelve al fondo
 * con loop, o fija en 0 sin loop. Puro. TU: replay.test.ts. */
export function replayAdvance(
  minutesBack: number,
  speed: number,
  dtSec: number,
  maxMin: number,
  loop: boolean,
): number {
  const next = minutesBack - dtSec * speed * 20;
  if (next <= 0) return loop ? maxMin : 0;
  return Math.min(maxMin, next);
}

/** Mapeo espejo del slider del TimeBar (W-4 C1): la posición va de 0
 * (izquierda, −max) a maxReplayMin (derecha, «ahora»). Convierte en ambos
 * sentidos (es su propia inversa): posición → minutos atrás y minutos →
 * posición. Unifica value={minutesBack} y el onChange (quirk espejo
 * reportado en 326/328). Puro. TU: replay.test.ts. */
export function replaySliderOffset(maxReplayMin: number, position: number): number {
  return maxReplayMin - position;
}

/** Referencia del tamaño de punto (default 11 == base 140 del shader). */
export const STATION_POINT_REF = 11;

/** Clamp [2,30] (setPointSize, IonosondeLayer.h:72). */
export function stationPointSizeClamp(v: number): number {
  if (!(v > 0)) return 2;
  if (v < 2) return 2;
  if (v > 30) return 30;
  return v;
}

/** Muestrear la historia de una estación en un instante (lerp como sampleHistoryAt del C++) */
export function sampleStationAt(
  s: IonosondeStation,
  epochMs: number
): number | null {
  const h = s.history;
  if (!h || h.length === 0) return s.foF2;
  const ts = h.map((x) => Date.parse(x.t.endsWith("Z") ? x.t : x.t + "Z"));
  if (epochMs <= ts[0]) return h[0].foF2;
  if (epochMs >= ts[ts.length - 1]) return h[h.length - 1].foF2;
  let lo = 0,
    hi = ts.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (ts[m] <= epochMs) lo = m;
    else hi = m;
  }
  const f = (epochMs - ts[lo]) / (ts[hi] - ts[lo] || 1);
  const a = h[lo].foF2,
    b = h[hi].foF2;
  if (a <= 0) return b;
  if (b <= 0) return a;
  return a + f * (b - a);
}
