"use client";

/**
 * Hook de alertas (drop 353): encapsula el motor vivo, el snapshot del
 * panel, las preferencias persistentes, el toast (use-toast, sin Sonner)
 * y el chime Web Audio. page.tsx deja de contener el efecto del motor.
 *
 * Reglas: no avisa en la primera evaluacion (baseline); solo transiciones
 * ASCENDENTES a AMBER/RED, una vez por evento; el sonido jamas lanza si el
 * navegador bloquea autoplay.
 */
import * as React from "react";
import {
  AlertEngine,
  RULE_NAMES,
  AlertLevel,
  buildAlertInput,
  type AlertSnapshot,
  type SwLike,
} from "@/lib/iono/alerts";
import {
  DEFAULT_ALERT_PREFS,
  loadAlertPrefs,
  saveAlertPrefs,
  normalizeAlertPrefs,
  type AlertPrefs,
} from "@/lib/iono/alertPrefs";
import { toast as showToast } from "@/hooks/use-toast";

const LVL_TXT = ["GREEN", "AMBER", "RED", "OFF"] as const;

/** localStorage puede lanzar SecurityError (sandbox/iframes): acceso a prueba. */
function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Transicion ascendente notificable (OFF=3 NO cuenta como "mayor"). */
export function isNotifiable(from: AlertLevel, to: AlertLevel): boolean {
  if (to === AlertLevel.RED && from !== AlertLevel.RED) return true;
  if (to === AlertLevel.AMBER && (from === AlertLevel.GREEN || from === AlertLevel.OFF)) return true;
  return false;
}

let audioCtx: AudioContext | null = null;

/**
 * Chime corto Web Audio (sin dependencias). RED: tres blips mas agudos y
 * urgentes; AMBER: dos blips suaves. Best-effort: cualquier bloqueo de
 * autoplay se traga sin error en consola.
 */
export function playAlertChime(level: "AMBER" | "RED"): void {
  try {
    if (typeof window === "undefined") return;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx ??= new Ctor();
    const ctx = audioCtx;
    if (ctx.state === "suspended") void ctx.resume().catch(() => undefined);
    const t0 = ctx.currentTime + 0.02;
    const notes =
      level === "RED"
        ? [
            { f: 880, t: 0, d: 0.1, g: 0.18 },
            { f: 660, t: 0.12, d: 0.1, g: 0.18 },
            { f: 880, t: 0.24, d: 0.16, g: 0.22 },
          ]
        : [
            { f: 523.25, t: 0, d: 0.12, g: 0.12 },
            { f: 659.25, t: 0.14, d: 0.16, g: 0.12 },
          ];
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = n.f;
      gain.gain.setValueAtTime(0.0001, t0 + n.t);
      gain.gain.exponentialRampToValueAtTime(n.g, t0 + n.t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.t + n.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + n.t);
      osc.stop(t0 + n.t + n.d + 0.02);
    }
  } catch {
    /* autoplay/bloqueo: silencio honesto */
  }
}

function notify(level: "AMBER" | "RED", rule: number, from: AlertLevel, to: AlertLevel, prefs: AlertPrefs): void {
  if (prefs.toast) {
    showToast({
      title: `Alert ${level} · ${RULE_NAMES[rule]}`,
      description: `${LVL_TXT[from]} → ${LVL_TXT[to]}`,
      duration: 6000,
    });
  }
  if (prefs.sound) playAlertChime(level);
}

export function useAlerts(sw: SwLike | null, ionos: { stations?: { muf3000?: number | null }[] } | null) {
  const engineRef = React.useRef<AlertEngine | null>(null);
  const [snap, setSnap] = React.useState<AlertSnapshot | null>(null);
  const [prefs, setPrefsState] = React.useState<AlertPrefs>(DEFAULT_ALERT_PREFS);
  const prefsRef = React.useRef(prefs);
  const baselineRef = React.useRef(false); // primera evaluacion = baseline, sin avisos
  const loadedRef = React.useRef(false);
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carga 1 vez en cliente (no pisar defaults antes de leer).
  React.useEffect(() => {
    // microtask: evita setState sincrono en el cuerpo del effect (lint)
    queueMicrotask(() => {
      setPrefsState(loadAlertPrefs(safeStorage()));
      loadedRef.current = true;
    });
  }, []);

  // Persistencia con debounce; solo tras la carga inicial.
  React.useEffect(() => {
    prefsRef.current = prefs;
    if (!loadedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => saveAlertPrefs(safeStorage(), prefs), 250);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [prefs]);

  // Cambio de umbrales -> motor conserva historia/estado.
  React.useEffect(() => {
    const eng = engineRef.current;
    if (eng) eng.setThresholds(prefs.thresholds);
  }, [prefs.thresholds]);

  // Evaluacion al publicar datos (sw/ionos) o al cambiar umbrales.
  React.useEffect(() => {
    const eng = (engineRef.current ??= new AlertEngine(prefs.thresholds));
    const mufs = (ionos?.stations ?? []).map((s) => s.muf3000);
    // Cola acotada (LOG_MAX): marcar el ultimo evento previo por REFERENCIA;
    // el indice numerico no sirve si evaluate hace shift (drop 353 n2).
    const prev = eng.events();
    const lastRef = prev.length > 0 ? prev[prev.length - 1] : null;
    eng.evaluate(buildAlertInput(sw, mufs, Date.now() / 1000));
    const all = eng.events();
    let start = 0;
    if (lastRef) {
      const idx = all.indexOf(lastRef);
      // lastRef es el mas nuevo antes de evaluate: no puede salir por shift
      // (shift elimina los mas viejos); fallback por seguridad.
      start = idx === -1 ? all.length : idx + 1;
    }
    const events = all.slice(start);
    const levels = [eng.level(0), eng.level(1), eng.level(2), eng.level(3)];
    const next: AlertSnapshot = { overall: eng.overall(), levels, events: [...all] };
    if (baselineRef.current) {
      for (const ev of events) {
        if (isNotifiable(ev.from, ev.to)) {
          notify(ev.to === AlertLevel.RED ? "RED" : "AMBER", ev.rule, ev.from, ev.to, prefsRef.current);
        }
      }
    } else {
      baselineRef.current = true; // primera evaluacion: solo foto, sin toast/chime
    }
    // microtask: evita setState sincrono en el cuerpo del effect (lint)
    queueMicrotask(() => setSnap(next));
  }, [sw, ionos, prefs.thresholds]);

  const setPrefs = React.useCallback((patch: Partial<AlertPrefs>) => {
    setPrefsState((p) => normalizeAlertPrefs({ ...p, ...patch }));
  }, []);

  /** Prueba explicita del boton: suena siempre (independiente del toggle). */
  const testSound = React.useCallback(() => {
    playAlertChime("RED");
  }, []);

  return { snap, prefs, setPrefs, testSound };
}
