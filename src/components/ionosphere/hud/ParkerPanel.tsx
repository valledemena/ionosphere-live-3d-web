"use client";

import { SpaceWeatherData } from "../types";
import { PanelBox, SourceDot } from "./SpaceWeatherPanel";
import { spiralPoints, sectorPolarity, findCrossings, spiralLagDeg } from "@/lib/iono/parker";
import { useNow } from "@/hooks/use-now";

/** W-4 F2b #12: Parker spiral panel (EN for all new UI).
 * Top-down ecliptic schematic from LIVE solar wind (O12): the arm
 * through Earth with the real v_sw, polarity from real Bx, sector
 * crossings CALCULATED from the data (notification only on a real
 * recent crossing — no crossing means no notification). */
export default function ParkerPanel({ sw }: { sw: SpaceWeatherData | null }) {
  const now = useNow();
  if (!sw || now === null) {
    return (
      <PanelBox title="Parker spiral">
        <div className="text-xs text-slate-500 py-6 text-center animate-pulse">
          Waiting for solar wind…
        </div>
      </PanelBox>
    );
  }
  const v = sw.wind.speed > 0 ? sw.wind.speed : 400;
  const pts = spiralPoints(v, 48);
  // Sin feed mag el Bx cae a 0 ("toward" por defecto): no mostrar
  // polaridad como dato (observación menor del veredicto 290).
  const magLive = sw.mag.source !== "unavailable" && sw.mag.series.length > 0;
  const pol = sectorPolarity(sw.wind.bx);
  const crossings = findCrossings(sw.mag.series.map((p) => ({ t: p.t, bx: p.bx })));
  const recent = crossings.filter((t) => now - t < 6 * 3600_000);
  const lag = spiralLagDeg(v, 1);

  // SVG: 120x90, Sun at center-left, Earth at (86, 45), 1 AU = 56 px.
  const S = 56 / 1.5;
  const cx = 30;
  const cy = 45;
  const d = pts.map((p) => `${(cx + p.x * S).toFixed(1)},${(cy - p.y * S).toFixed(1)}`).join(" ");
  const earthX = cx + 1 * S;
  const polColor = pol === "toward" ? "#f87171" : "#60a5fa";
  const armColor = magLive ? polColor : "#64748b";

  return (
    <PanelBox title="Parker spiral" badge={<SourceDot source={sw.wind.source} />}>
      <svg viewBox="0 0 120 90" className="w-full rounded bg-white/5">
        <circle cx={cx} cy={cy} r={4} fill="#fbbf24" />
        <polyline points={d} fill="none" stroke={armColor} strokeWidth={1.4} opacity={0.9} />
        <circle cx={earthX} cy={cy} r={2.6} fill="#38bdf8" />
        <text x={earthX + 4} y={cy + 3} fontSize={7} fill="#7dd3fc">Earth</text>
      </svg>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] text-slate-400 font-mono">v {v} km/s · foot +{lag.toFixed(0)}°</span>
        <span className="text-[11px] font-medium" style={{ color: magLive ? polColor : "#64748b" }}>
          {magLive ? pol : "no Bx data"}
        </span>
      </div>
      {recent.length > 0 ? (
        <div className="text-[10px] text-amber-200 mt-0.5">
          Sector crossing {new Date(recent[recent.length - 1]).toISOString().slice(11, 16)}Z — real data.
        </div>
      ) : (
        <div className="text-[10px] text-slate-600 mt-0.5">
          No sector crossing in 6 h — no notification (O12 negative).
        </div>
      )}
      <p className="text-[10px] text-slate-500 leading-snug mt-2 pt-2 border-t border-white/10">
        Parker 1958 geometry from live wind — not a simulation. Snapshot at current v.
      </p>
    </PanelBox>
  );
}
