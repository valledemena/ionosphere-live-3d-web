import * as React from "react"

const DEFAULT_TICK_MS = 30_000

/**
 * Hora alineada al tick mas cercano (`tickMs`, default 30 s), legible en
 * render sin impureza (drop 339, react-hooks/purity). Devuelve `null` en
 * SSR/hidratacion: el caller debe renderizar su placeholder existente hasta
 * que llegue el snapshot del cliente (nunca NaN). `getSnapshot` es estable
 * dentro del tick: cambia solo al cruzar el borde (drop 340).
 */
export function useNow(tickMs: number = DEFAULT_TICK_MS): number | null {
  const subscribe = React.useCallback(
    (onStoreChange: () => void): (() => void) => {
      const id = setInterval(onStoreChange, tickMs)
      return () => clearInterval(id)
    },
    [tickMs]
  )
  const getSnapshot = React.useCallback(
    (): number => Math.floor(Date.now() / tickMs) * tickMs,
    [tickMs]
  )
  const getServerSnapshot = React.useCallback((): null => null, [])
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
