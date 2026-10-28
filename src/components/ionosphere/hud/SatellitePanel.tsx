"use client";

import { Orbit, Satellite } from "lucide-react";
import type { CatalogPayload } from "@/lib/iono/satellites/catalog";
import { satPanelState } from "@/lib/iono/satellites/panel";
import {
  RING_ALT_KM_MAX,
  RING_ALT_KM_MIN,
  RING_DIPOLE_LENGTH_M,
  RING_DIPOLES,
  RING_INC_DEG,
  RING_LABEL,
} from "@/lib/iono/satellites/ring1963";
import { PanelBox } from "./SpaceWeatherPanel";

/**
 * W-4 F2b #10 (drop 321, ruling 320): eco orbital 2026 + anillo 1963.
 * Contract: the live label is shown byte-for-byte (never re-derived);
 * server "unavailable" -> "sin datos"; client fetch failure is a SEPARATE
 * state "sin conexión con la ruta". The 1963 ring row is permanent (never
 * a tooltip) and carries the exact declared-reconstruction text.
 */
export default function SatellitePanel({
  sat,
  down,
}: {
  sat: CatalogPayload | null;
  down: boolean;
}) {
  const st = satPanelState(sat, down);
  return (
    <PanelBox
      title="Orbital echo 2026"
      badge={
        sat && sat.source !== "unavailable" ? (
          <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-slate-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                sat.source === "snapshot" ? "bg-amber-300" : "bg-emerald-400 animate-pulse"
              }`}
            />
            {sat.source === "snapshot" ? "frozen" : "live"}
          </span>
        ) : undefined
      }
    >
      {st.kind === "loading" && (
        <div className="text-xs text-slate-500 py-6 text-center animate-pulse">
          Contacting live catalog…
        </div>
      )}
      {st.kind === "error" && (
        <div className="text-xs text-amber-300/90 py-4 text-center">{st.text}</div>
      )}
      {st.kind === "unavailable" && (
        <div className="text-xs text-slate-400 py-3 text-center">
          {st.text}
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            captured {new Date(st.fetchedAt).toISOString().slice(11, 16)} UTC
          </div>
        </div>
      )}
      {st.kind === "ok" && (
        <>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
              <Satellite size={12} /> Catalog
            </span>
            <span className="text-xs text-slate-200">{st.label}</span>
          </div>
          <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-slate-400">
            <span>{st.count.toLocaleString("en-US")} objects</span>
            <span>{st.dropped} dropped</span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            captured {new Date(st.fetchedAt).toISOString().slice(11, 16)} UTC
          </div>
          <div className="text-[10px] text-slate-500 leading-snug mt-1">{st.attribution}</div>
        </>
      )}

      {/* Anillo West Ford 1963: declarado, jamas vivo. Fila permanente. */}
      <div className="mt-2 pt-2 border-t border-white/10">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
          <Orbit size={12} /> West Ford ring 1963
        </div>
        <div className="text-[10px] text-amber-200/90 leading-snug mt-0.5">{RING_LABEL}</div>
        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
          {RING_ALT_KM_MIN.toLocaleString("en-US")}×{RING_ALT_KM_MAX.toLocaleString("en-US")} km · i{" "}
          {RING_INC_DEG}° · {(RING_DIPOLES / 1e8).toFixed(1)}e8 dipoles{" "}
          {(RING_DIPOLE_LENGTH_M * 100).toFixed(2)} cm (SAGE 2025)
        </div>
      </div>
    </PanelBox>
  );
}
