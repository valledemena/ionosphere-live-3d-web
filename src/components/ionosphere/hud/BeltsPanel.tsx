"use client";

import { Donut } from "lucide-react";
import { RbeData } from "../types";
import { PanelBox, SourceDot } from "./SpaceWeatherPanel";
import { beltOuterL, rbeGlow, BELT_INNER_L } from "@/lib/iono/belts";

/** W-4 F2a #19: Van Allen panel (EN for all new UI).
 * Parametric v1 by Kp (declared; AE9/AP9 is v2, not F2) + REAL RBE
 * events from DONKI driving the outer-belt glow with the feed date. */
export default function BeltsPanel({
  rbe,
  kp,
  epochMs,
}: {
  rbe: RbeData | null;
  kp: number;
  epochMs: number;
}) {
  if (!rbe) {
    return (
      <PanelBox title="Belts">
        <div className="text-xs text-slate-500 py-6 text-center animate-pulse">
          Checking DONKI RBE…
        </div>
      </PanelBox>
    );
  }
  const latest = rbe.events[0] ?? null;
  const glow = rbeGlow(latest?.time ?? null, epochMs);

  return (
    <PanelBox title="Belts" badge={<SourceDot source={rbe.source} />}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
          <Donut size={12} /> Inner / outer
        </span>
        <span className="text-[11px] font-mono text-slate-200">
          L {BELT_INNER_L.toFixed(1)} Ag · L {beltOuterL(kp).toFixed(1)} Au
        </span>
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5">
        protons drift west · electrons drift east (deterministic)
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-white/10">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">
          Latest RBE {latest ? "" : "(none in window)"}
        </div>
        {latest && (
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[10px] text-slate-300 font-mono">
              {latest.time ? new Date(latest.time).toISOString().slice(0, 10) : "—"} · glow {glow.toFixed(2)}
            </span>
            {latest.link && (
              <a href={latest.link} target="_blank" rel="noreferrer" className="text-[10px] text-cyan-400/80 hover:text-cyan-300">
                CCMC
              </a>
            )}
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-500 leading-snug mt-2 pt-2 border-t border-white/10">
        Parametric v1 by Kp — RBE: DONKI/CCMC. Outer glow follows the feed date.
      </p>
    </PanelBox>
  );
}
