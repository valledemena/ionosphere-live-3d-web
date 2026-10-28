"use client";

import { Radio } from "lucide-react";
import { WsprData } from "../types";
import { PanelBox, SourceDot } from "./SpaceWeatherPanel";
import { bandOpening, bandColor } from "@/lib/iono/wspr";
import { solarZenithDeg } from "@/lib/iono/solar";

/** W-4 #5: panel de apertura por banda CALCULADO DE LOS SPOTS mostrados
 * (O5.3: misma lista que los arcos del mapa — panel y mapa no discrepan).
 * Atribucion visible a la red de voluntarios (O5.1); fallback honesto
 * (O5.4); el conteo diurnos cierra O3.5 (enfriamiento dayside visible). */
export default function WsprPanel({
  wspr,
  epochMs,
}: {
  wspr: WsprData | null;
  epochMs: number;
}) {
  if (!wspr) {
    return (
      <PanelBox title="WSPRnet">
        <div className="text-xs text-slate-500 py-6 text-center animate-pulse">
          Querying spots…
        </div>
      </PanelBox>
    );
  }
  const opening = bandOpening(wspr.spots);
  const maxCount = Math.max(1, ...opening.map((b) => b.count));
  const day = wspr.spots.filter(
    (s) =>
      solarZenithDeg((s.txLat + s.rxLat) / 2, (s.txLon + s.rxLon) / 2, epochMs / 1000) < 90
  ).length;

  return (
    <PanelBox title="WSPRnet" badge={<SourceDot source={wspr.source} />}>
      {wspr.spots.length === 0 ? (
        <div className="text-[11px] text-slate-500 py-3 text-center">
          No data (feed down or no network) — never fake spots.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
              <Radio size={12} /> Opening by band
            </span>
            <span className="text-[11px] text-slate-300 font-mono">
              {wspr.spots.length} spots · {day} dayside
            </span>
          </div>
          {opening.map((b) => {
            const c = bandColor(b.band);
            const css = `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
            return (
              <div key={b.band} className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-mono text-slate-400 w-9">{b.band}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(b.count / maxCount) * 100}%`, background: css }} />
                </div>
                <span className="text-[10px] font-mono text-slate-300 w-14 text-right">
                  {b.count} · {b.bestSnr} dB
                </span>
              </div>
            );
          })}
        </>
      )}
      <p className="text-[10px] text-slate-500 leading-snug mt-2 pt-2 border-t border-white/10">
        Real volunteer spots (WSPRnet olddb) · ~10 min persistence
        declared · the HF highway in use.
      </p>
    </PanelBox>
  );
}
