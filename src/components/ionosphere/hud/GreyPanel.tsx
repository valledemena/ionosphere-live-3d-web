"use client";

import { Sunrise } from "lucide-react";
import { WsprData } from "../types";
import { PanelBox } from "./SpaceWeatherPanel";
import { filterGreySpots, GREY_HALF_WIDTH_DEG } from "@/lib/iono/greyline";
import { getSunInfo } from "@/lib/iono/solar";
import { bandOpening } from "@/lib/iono/wspr";

/** W-4 #6: grey-line panel — propagation along the terminator.
 * Zero external sources (O6.1): everything derives from the program's
 * own sun. O6.3 superposition: WSPR spots inside the band, computed
 * from the SAME shown list as the arcs (no separate model). */
export default function GreyPanel({
  wspr,
  epochMs,
}: {
  wspr: WsprData | null;
  epochMs: number;
}) {
  const sun = getSunInfo(epochMs / 1000);
  const grey = wspr ? filterGreySpots(wspr.spots, epochMs / 1000) : [];
  const bands = bandOpening(grey);

  return (
    <PanelBox
      title="Grey line"
      badge={<span className="text-[9px] uppercase tracking-wider text-slate-500">own ephemeris</span>}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
          <Sunrise size={12} /> Terminator band
        </span>
        <span className="text-[11px] text-slate-200 font-mono">
          ±{GREY_HALF_WIDTH_DEG}°
        </span>
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
        subsolar {sun.subsolarLat.toFixed(1)}°, {sun.subsolarLon.toFixed(1)}°
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-slate-400">WSPR in the band</span>
        <span className="text-xs text-amber-200 font-semibold font-mono">
          {wspr ? `${grey.length}/${wspr.spots.length}` : "—"}
        </span>
      </div>
      {bands.length > 0 && (
        <div className="text-[10px] text-slate-400 mt-0.5">
          {bands.map((b) => `${b.band}×${b.count}`).join(" · ")}
        </div>
      )}
      {!wspr && (
        <div className="text-[10px] text-slate-600 mt-1">
          Spot superposition appears once WSPR data loads.
        </div>
      )}
      <p className="text-[10px] text-slate-500 leading-snug mt-2 pt-2 border-t border-white/10">
        Own ephemeris only — no external sources. Overlay layer; the
        sun/night render is untouched.
      </p>
    </PanelBox>
  );
}
