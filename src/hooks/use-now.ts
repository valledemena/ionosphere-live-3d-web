import * as React from "react"

const TICK_MS = 30_000

function getSnapshot(): number {
  // Estable dentro del tick: cambia solo al cruzar el borde de 30 s.
  return Math.floor(Date.now() / TICK_MS) * TICK_MS
}

function subscribe(onStoreChange: () => void): () => void {
  const id = setInterval(onStoreChange, TICK_MS)
  return () => clearInterval(id)
}

function getServerSnapshot(): null {
  return null
}

/**
 * Hora alineada al tick mas cercano (30 s), legible en render sin impureza
 * (drop 339, react-hooks/purity). Devuelve `null` en SSR/hidratacion: el
 * caller debe renderizar su placeholder existente hasta que llegue el
 * snapshot del cliente (nunca NaN).
 */
export function useNow(): number | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
