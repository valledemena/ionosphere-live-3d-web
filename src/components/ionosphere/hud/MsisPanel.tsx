"use client";

import { Thermometer } from "lucide-react";
import { MsisData } from "../types";
import { PanelBox, SourceDot } from "./SpaceWeatherPanel";

/** W-4 F2b #9d: thermosphere panel (EN for all new UI).
 * Tn + mass density computed LIVE by the local NRLMSIS 2.1 port
 * (no mock, no upstream): profile 100-600 km plus grid means at the
 * requested altitude. Solar/geomagnetic inputs are reference quiet
 * defaults unless overridden (echoed by the route). */
export default function MsisPanel({ msis }: { msis: MsisData | null }) {
  if (!msis || !msis.point || !isFinite(msis.point.tn) || !isFinite(msis.point.rho)) {
    return (
      <PanelBox title="Thermosphere">
        <div className="text-xs text-slate-500 py-6 text-center animate-pulse">
          {msis ? "Model warming up (honest, never fictitious)." : "Starting local NRLMSIS model…"}
        </div>
      </PanelBox>
    );
  }
  const p = msis.point;
  return (
    <PanelBox title="Thermosphere" badge={<SourceDot source={msis.source} />}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
          <Thermometer size={12} /> Tn @ {p.altKm} km
        </span>
        <span className="text-xs font-mono text-slate-200">{p.tn.toFixed(1)} K</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] uppercase tracking-wider text-slate-400">Rho @ {p.altKm} km</span>
        <span className="text-xs font-mono text-slate-200">{p.rho.toExponential(2)} g/cm³</span>
      </div>
      <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 mt-1.5 text-[10px] font-mono text-slate-400">
        {msis.profile.map((r) => (
          <span key={r.altKm}>
            {r.altKm}k {r.tn.toFixed(0)}K
          </span>
        ))}
      </div>
      <div className="text-[10px] text-slate-500 font-mono mt-1">
        grid mean Tn {msis.grid.tnMean.toFixed(1)} K · rho {msis.grid.rhoMean.toExponential(1)}
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5">
        F10.7 {msis.inputs.f107a}/{msis.inputs.f107} · Ap {msis.inputs.apDaily}
        {msis.inputs.referenceDefaults ? " (reference quiet)" : " (requested)"}
      </div>
    </PanelBox>
  );
}
