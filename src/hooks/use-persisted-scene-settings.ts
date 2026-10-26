"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, type SceneSettings } from "@/components/ionosphere/types";
import {
  loadSceneSettings,
  saveSceneSettings,
  serializeSceneSettings,
} from "@/components/ionosphere/settingsStorage";

export function usePersistedSceneSettings(): readonly [
  SceneSettings,
  (patch: Partial<SceneSettings>) => void,
] {
  const [settings, setSettings] = useState<SceneSettings>(DEFAULT_SETTINGS);
  const loadedRef = useRef(false);
  const lastSavedRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    // microtask: evita setState sincrono en el cuerpo del effect (lint),
    // igual que use-alerts.
    queueMicrotask(() => {
      if (!alive) return;
      const stored = loadSceneSettings();
      lastSavedRef.current = serializeSceneSettings(stored);
      loadedRef.current = true;
      setSettings(stored);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!loadedRef.current) return;
    const serialized = serializeSceneSettings(settings);
    if (serialized === lastSavedRef.current) return;
    const timer = setTimeout(() => {
      saveSceneSettings(settings);
      lastSavedRef.current = serialized;
    }, 200);
    return () => clearTimeout(timer);
  }, [settings]);

  const update = useCallback((patch: Partial<SceneSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
  }, []);

  return [settings, update] as const;
}
