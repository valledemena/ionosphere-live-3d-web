"use client";

import { CloudRainWind } from "lucide-react";
import { SpaceWeatherData } from "../types";
import { PanelBox, SourceDot } from "./SpaceWeatherPanel";
import { fadeoutGrid, fadeoutStats, latestProtonFlux, FADEOUT_W, FADEOUT_H } from "@/lib/iono/fadeout";

const DRAP_LATEST = "https://services.swpc.noaa.gov/images/animations/d-rap/global/latest.png";
const DRAP_LINK = "https://www.swpc.noaa.gov/products/d-region-absorption-predictions-d-rap";

/** W-4 F2a #2: global fadeout panel — same grid the scene draws (O5.3
 * doctrine: panel and map cannot disagree). D-RAP image is the
 * VALIDATION reference (declared); negatives per O2 always visible. */
export default function FadePanel({
  sw,
  epochMs,
}: {
  sw: SpaceWeatherData | null;
  epochMs: number;
}) {
  if (!sw) {
    return (
      <PanelBox title="Fadeout">
        <div className="text-xs text-slate-500 py-6 text-center animate-pulse">
          Waiting for GOES input…
        </div>
      </PanelBox>
    );
  }
  const xr = sw.xray.seriesDay.length ? sw.xray.seriesDay : sw.xray.series;
  const peak = xr.reduce((m, p) => (p.f > m.f ? p : m), { t: 0, f: 0 });
  const pflux = latestProtonFlux(
    sw.protons.series.map((p) => ({ t: p.t, f: p.f })),
    epochMs
  );
  const grid = fadeoutGrid(peak.f, sw.kp.now, pflux, epochMs / 1000);
  const st = fadeoutStats(grid, FADEOUT_W, FADEOUT_H, peak.f);

  return (
    <PanelBox title="Fadeout" badge={<SourceDot source={sw.xray.source} />}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
          <CloudRainWind size={12} /> Peak absorption
        </span>
        <span className={`font-mono font-semibold ${st.quiet ? "text-emerald-400" : "text-red-400"}`}>
          {st.maxDb < 0.05 ? "quiet" : `${st.maxDb.toFixed(1)} dB`}
        </span>
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
        max {st.maxLat.toFixed(0)}°, {st.maxLon.toFixed(0)}° · &gt;3 dB over {st.areaPct.toFixed(1)}% of globe
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5">
        PCA ≥10 MeV: {pflux >= 10 ? `${pflux.toFixed(0)} pfu — polar cap active` : "below 10 pfu — off"}
      </div>
      {!st.quiet && (
        <div className="text-[10px] text-red-300/90 mt-1">
          Dayside fadeout from live X-ray — night side never affected.
        </div>
      )}
      {/* O2: D-RAP as validation reference (declared). */}
      <a href={DRAP_LINK} target="_blank" rel="noreferrer" className="block mt-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagen remota viva; sin optimizador a propósito */}
        <img
          src={DRAP_LATEST}
          alt="D-RAP absorption map (NOAA validation reference)"
          className="w-full rounded-lg ring-1 ring-white/10"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      </a>
      <div className="text-[10px] text-slate-600 mt-0.5">
        D-RAP validation reference (NOAA) — no eligible flare means no fadeout.
      </div>
    </PanelBox>
  );
}
