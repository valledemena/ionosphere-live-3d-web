"use client";

import { Zap } from "lucide-react";
import { LightningData } from "../types";
import { PanelBox, SourceDot } from "./SpaceWeatherPanel";
import { glmStatus } from "@/lib/iono/lightning";
import { useNow } from "@/hooks/use-now";

/** W-4 F2a #8: lightning panel (EN for all new UI).
 * GLM granule freshness per satellite (input truth, Americas coverage
 * declared) + NWS storm cells driving the sprites (declared threshold:
 * active warning present; no warnings means no sprites). Outside the
 * Americas there are no real-time strokes in v1 — visible limitation. */
export default function LightningPanel({ lightning }: { lightning: LightningData | null }) {
  const now = useNow();
  if (!lightning || now === null) {
    return (
      <PanelBox title="Lightning">
        <div className="text-xs text-slate-500 py-6 text-center animate-pulse">
          Checking GLM feeds…
        </div>
      </PanelBox>
    );
  }
  const g19 = glmStatus(
    lightning.granules.map((g) => ({ sat: g.sat, start: g.start, end: g.end, size: g.size })),
    "G19",
    now
  );
  const g18 = glmStatus(
    lightning.granules.map((g) => ({ sat: g.sat, start: g.start, end: g.end, size: g.size })),
    "G18",
    now
  );

  return (
    <PanelBox title="Lightning" badge={<SourceDot source={lightning.source} />}>
      {(["G19 East", "G18 West"] as const).map((label) => {
        const st = label.startsWith("G19") ? g19 : g18;
        return (
          <div key={label} className="flex items-center justify-between mt-0.5">
            <span className="text-[11px] text-slate-500 font-mono">GLM {label}</span>
            <span className={`text-[11px] font-medium ${st.fresh ? "text-emerald-400" : "text-slate-500"}`}>
              {st.ageSec != null ? (st.fresh ? `live · ${st.ageSec.toFixed(0)}s ago` : `stale · ${st.ageSec.toFixed(0)}s`) : "no data"}
            </span>
          </div>
        );
      })}
      <div className="flex items-center justify-between mt-1.5">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
          <Zap size={12} /> Storm cells
        </span>
        <span className={`text-xs font-semibold ${lightning.storms.length ? "text-red-400" : "text-slate-500"}`}>
          {lightning.storms.length ? `${lightning.storms.length} active` : "none — no sprites"}
        </span>
      </div>
      {lightning.storms.slice(0, 4).map((s) => (
        <div key={s.id || s.area} className="text-[10px] text-slate-400 mt-0.5 truncate" title={s.area}>
          {s.area} ({s.lat.toFixed(1)}°, {s.lon.toFixed(1)}°)
        </div>
      ))}
      <p className="text-[10px] text-slate-500 leading-snug mt-2 pt-2 border-t border-white/10">
        Whistlers duct along real B(r) field lines (Helliwell). Coverage:
        Americas only — no real-time strokes elsewhere in v1.
      </p>
    </PanelBox>
  );
}
