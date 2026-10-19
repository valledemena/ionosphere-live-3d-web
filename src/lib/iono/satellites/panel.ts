/**
 * W-4 F2b #10 (ruling 320): estados del panel del eco 2026.
 *
 * Contrato de honestidad: el label del payload se muestra BYTE A BYTE
 * (sin re-derivar); "unavailable" del servidor -> "sin datos"; fallo del
 * cliente (fetch null) -> estado separado "sin conexión con la ruta".
 * Puro y table-driven (panel.test.ts).
 */
import type { CatalogPayload } from "./catalog";

/** Fallo de cliente: la ruta no responde (fetch null / red). */
export const SAT_ERR_TEXT = "sin conexión con la ruta";
/** Servidor respondio source="unavailable" (cadena agotada). */
export const SAT_NA_TEXT = "sin datos";

export type SatPanelState =
  | { kind: "loading" }
  | { kind: "error"; text: string }
  | { kind: "unavailable"; text: string; fetchedAt: number }
  | {
      kind: "ok";
      label: string;
      attribution: string;
      fetchedAt: number;
      count: number;
      dropped: number;
      source: string;
    };

export function satPanelState(
  payload: CatalogPayload | null,
  clientDown: boolean,
): SatPanelState {
  if (!payload) {
    return clientDown
      ? { kind: "error", text: SAT_ERR_TEXT }
      : { kind: "loading" };
  }
  if (payload.source === "unavailable") {
    return {
      kind: "unavailable",
      text: SAT_NA_TEXT,
      fetchedAt: payload.fetchedAt,
    };
  }
  return {
    kind: "ok",
    label: payload.sourceLabel,
    attribution: payload.attribution,
    fetchedAt: payload.fetchedAt,
    count: payload.count,
    dropped: payload.dropped,
    source: payload.source,
  };
}
