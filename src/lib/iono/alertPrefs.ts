/**
 * Preferencias de alertas persistidas (drop 353). Logica pura: el storage
 * se inyecta (o null para SSR/test) — sin DOM real en los tests. Tolerante
 * a JSON corrupto, claves ausentes y localStorage no disponible.
 */
import {
  DEFAULT_ALERT_THRESHOLDS,
  normalizeAlertThresholds,
  type AlertThresholds,
} from "./alerts";

export interface AlertPrefs {
  thresholds: AlertThresholds;
  toast: boolean;
  sound: boolean;
}

export const DEFAULT_ALERT_PREFS: AlertPrefs = {
  thresholds: DEFAULT_ALERT_THRESHOLDS,
  toast: true,
  sound: false,
};

export const ALERT_PREFS_KEY = "ionosphere.alerts.prefs.v1";

type Reader = { getItem(k: string): string | null };
type Writer = { getItem(k: string): string | null; setItem(k: string, v: string): void };

/** Coerccion defensiva de prefs desconocidas a AlertPrefs completo. */
export function normalizeAlertPrefs(v: unknown): AlertPrefs {
  const o = (v ?? {}) as Partial<AlertPrefs>;
  return {
    thresholds: normalizeAlertThresholds(o.thresholds),
    toast: typeof o.toast === "boolean" ? o.toast : DEFAULT_ALERT_PREFS.toast,
    sound: typeof o.sound === "boolean" ? o.sound : DEFAULT_ALERT_PREFS.sound,
  };
}

/** Carga; storage null/no-disponible o JSON invalido -> defaults. */
export function loadAlertPrefs(storage: Reader | null | undefined): AlertPrefs {
  if (!storage) return { ...DEFAULT_ALERT_PREFS, thresholds: { ...DEFAULT_ALERT_THRESHOLDS } };
  try {
    const raw = storage.getItem(ALERT_PREFS_KEY);
    if (raw == null || raw === "") return normalizeAlertPrefs(null);
    return normalizeAlertPrefs(JSON.parse(raw));
  } catch {
    return normalizeAlertPrefs(null);
  }
}

/** Guarda (best-effort); storage null o setItem que lanza se ignoran. */
export function saveAlertPrefs(storage: Writer | null | undefined, prefs: AlertPrefs): void {
  if (!storage) return;
  try {
    storage.setItem(ALERT_PREFS_KEY, JSON.stringify(normalizeAlertPrefs(prefs)));
  } catch {
    /* cuota/bloqueo: preferencias no criticas */
  }
}
