"use client";

import { Activity } from "lucide-react";
import { AeData } from "../types";
import { PanelBox, SourceDot } from "./SpaceWeatherPanel";
import { aeBand, aeColor } from "@/lib/iono/electrojets";
import Sparkline from "./Sparkline";

/** W-4 F2a #17: electrojet panel (EN for all new UI).
 * Live AE from Kyoto WDC (non-commercial, citation required — see
 * footer). Substorm correlation view lives in the Dst panel
 * (arrived with #18, O17). */
export default function AePanel({ ae }: { ae: AeData | null }) {
  if (!ae) {
    return (
      <PanelBox title="Electrojets">
        <div className="text-xs text-slate-500 py-6 text-center animate-pulse">
          Checking Kyoto AE…
        </div>
      </PanelBox>
    );
  }
  const band = aeBand(ae.now);
  const c = aeColor(ae.now);
  const css = `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
  const bandCls =
    band === "storm" ? "text-red-400" : band === "active" ? "text-amber-300" : "text-sky-400";

  return (
    <PanelBox title="Electrojets" badge={<SourceDot source={ae.source} />}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
          <Activity size={12} /> AE now
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: css }} />
          <span className={`text-lg font-semibold font-mono ${bandCls}`}>{ae.now} nT</span>
        </span>
      </div>
      <div className="flex justify-between items-center mt-1">
        <span className="text-[11px] text-slate-500">
          {band} · 24h max <span className="text-slate-300 font-mono">{ae.max24h} nT</span>
        </span>
        {ae.series.length > 2 && <Sparkline data={ae.series.map((p) => p.ae)} width={110} height={22} color="#fbbf24" min={0} />}
      </div>
      {/* P1-279: edad del dato (lag documentado de hasta 3 semanas). */}
      {ae.latestDate && (
        <div className="text-[10px] text-slate-500 mt-0.5">
          data {ae.latestDate} ({ae.ageDays}d old — Kyoto publishes with up to 3-week delay)
        </div>
      )}
      <div className="text-[10px] text-slate-600 mt-1">
        Substorm AE/Dst correlation below, in the Dst panel.
      </div>
      <p className="text-[10px] text-slate-500 leading-snug mt-2 pt-2 border-t border-white/10">
        AE index: WDC for Geomagnetism, Kyoto (non-commercial, citation required).
      </p>
    </PanelBox>
  );
}
