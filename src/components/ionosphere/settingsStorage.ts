import { DEFAULT_SETTINGS, type SceneSettings } from "./types";

export const SCENE_SETTINGS_STORAGE_KEY = "ionosphere.scene-settings.v1";

const ATMOS_QUALITIES = ["low", "medium", "high"] as const;
const SLICE_SOURCES = ["link", "manual", "fixed"] as const;
const VOLUME_MODES = ["density", "chapman"] as const;

function readBool(
  raw: Record<string, unknown>,
  key: string,
  fallback: boolean,
): boolean {
  const value = raw[key];
  return typeof value === "boolean" ? value : fallback;
}

function readNumber(
  raw: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  fallback: number,
): number {
  const value = raw[key];
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function readEnum<T extends string>(
  raw: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  const value = raw[key];
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function sanitizeSceneSettings(raw: unknown): SceneSettings {
  const d = DEFAULT_SETTINGS;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...d, timeMode: "live", replayMinutes: 0, replayPlaying: false };
  }
  const r = raw as Record<string, unknown>;
  return {
    clouds: readBool(r, "clouds", d.clouds),
    showStars: readBool(r, "showStars", d.showStars),
    atmoQuality: readEnum(r, "atmoQuality", ATMOS_QUALITIES, d.atmoQuality),
    showAurora: readBool(r, "showAurora", d.showAurora),
    showShell: readBool(r, "showShell", d.showShell),
    showStations: readBool(r, "showStations", d.showStations),
    showRings: readBool(r, "showRings", d.showRings),
    showLink: readBool(r, "showLink", d.showLink),
    showGodrays: readBool(r, "showGodrays", d.showGodrays),
    showVolume: readBool(r, "showVolume", d.showVolume),
    exaggeration: readNumber(r, "exaggeration", 1, 5, d.exaggeration),
    shellOpacity: readNumber(r, "shellOpacity", 0, 1, d.shellOpacity),
    nightLights: readNumber(r, "nightLights", 0, 1, d.nightLights),
    cinema: readBool(r, "cinema", d.cinema),
    timeMode: "live",
    replayMinutes: 0,
    replayPlaying: false,
    replaySpeed: readNumber(r, "replaySpeed", 0.5, 8, d.replaySpeed),
    replayLoop: readBool(r, "replayLoop", d.replayLoop),
    showSlice: readBool(r, "showSlice", d.showSlice),
    sliceSrc: readEnum(r, "sliceSrc", SLICE_SOURCES, d.sliceSrc),
    sliceLatA: readNumber(r, "sliceLatA", -90, 90, d.sliceLatA),
    sliceLonA: readNumber(r, "sliceLonA", -180, 180, d.sliceLonA),
    sliceLatB: readNumber(r, "sliceLatB", -90, 90, d.sliceLatB),
    sliceLonB: readNumber(r, "sliceLonB", -180, 180, d.sliceLonB),
    showIso: readBool(r, "showIso", d.showIso),
    showLabels: readBool(r, "showLabels", d.showLabels),
    volumeMode: readEnum(r, "volumeMode", VOLUME_MODES, d.volumeMode),
    volumeOpacity: readNumber(r, "volumeOpacity", 0, 2.5, d.volumeOpacity),
    showMagnetosphere: readBool(r, "showMagnetosphere", d.showMagnetosphere),
    showCme: readBool(r, "showCme", d.showCme),
    showFlare: readBool(r, "showFlare", d.showFlare),
    showWspr: readBool(r, "showWspr", d.showWspr),
    showGreyline: readBool(r, "showGreyline", d.showGreyline),
    showFadeout: readBool(r, "showFadeout", d.showFadeout),
    showLightning: readBool(r, "showLightning", d.showLightning),
    showAe: readBool(r, "showAe", d.showAe),
    showDst: readBool(r, "showDst", d.showDst),
    showBelts: readBool(r, "showBelts", d.showBelts),
    showSatellites: readBool(r, "showSatellites", d.showSatellites),
    showRing1963: readBool(r, "showRing1963", d.showRing1963),
    pointSize: readNumber(r, "pointSize", 3, 15, d.pointSize),
  };
}

export function parseSceneSettings(raw: string | null): SceneSettings {
  if (!raw) return sanitizeSceneSettings(null);
  try {
    return sanitizeSceneSettings(JSON.parse(raw));
  } catch {
    return sanitizeSceneSettings(null);
  }
}

export function serializeSceneSettings(settings: SceneSettings): string {
  const rest: Partial<SceneSettings> = { ...settings };
  delete rest.timeMode;
  delete rest.replayMinutes;
  delete rest.replayPlaying;
  return JSON.stringify(rest);
}

function safeStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function loadSceneSettings(): SceneSettings {
  const storage = safeStorage();
  if (!storage) return sanitizeSceneSettings(null);
  try {
    return parseSceneSettings(storage.getItem(SCENE_SETTINGS_STORAGE_KEY));
  } catch {
    return sanitizeSceneSettings(null);
  }
}

export function saveSceneSettings(settings: SceneSettings): void {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(SCENE_SETTINGS_STORAGE_KEY, serializeSceneSettings(settings));
  } catch {
    // localStorage lleno o bloqueado: la sesion sigue sin persistencia.
  }
}
