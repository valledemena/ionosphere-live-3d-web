"use client";

import { CircleDot } from "lucide-react";
import { DstData, AeData } from "../types";
import { PanelBox, SourceDot } from "./SpaceWeatherPanel";
import { dstBand, dstColor } from "@/lib/iono/dst";

/** W-4 F2a #18: Dst ring panel (EN for all new UI).
 * The ring follows REAL SYM-H/Dst (O18). The AE/Dst phase diagram is
 * fed from the SAME payloads the scene uses (O5.3 doctrine: panel and
 * map cannot disagree). GST storms are the declared DONKI complement.
 * Kyoto warns its realtime values come from unverified raw data. */
export default function DstPanel({ dst, ae }: { dst: DstData | null; ae: AeData | null }) {
  if (!dst) {
    return (
      <PanelBox title="Dst ring">
        <div className="text-xs text-slate-500 py-6 text-center animate-pulse">
          Checking Kyoto Dst…
        </div>
      </PanelBox>
    );
  }
  const band = dstBand(dst.now);
  const c = dstColor(dst.now);
  const css = `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
  const bandCls =
    band === "intense" ? "text-red-400" : band === "storm" ? "text-orange-300" : band === "unsettled" ? "text-amber-200" : "text-sky-400";

  // Phase diagram AE(up) vs Dst(down): same payloads, matched by hour.
  const aeByHour = new Map<number, number>();
  if (ae) {
    for (const p of ae.series) aeByHour.set(Math.floor(p.t / 3600_000), p.ae);
  }
  const dots: { x: number; y: number }[] = [];
  for (const p of dst.series) {
    const a = aeByHour.get(Math.floor(p.t / 3600_000));
    if (a != null) dots.push({ x: a, y: p.dst });
  }

  return (
    <PanelBox title="Dst ring" badge={<SourceDot source={dst.source} />}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
          <CircleDot size={12} /> Dst now
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: css }} />
          <span className={`text-lg font-semibold font-mono ${bandCls}`}>{dst.now} nT</span>
        </span>
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5">
        {band} · 7d min <span className="text-slate-300 font-mono">{dst.min7d} nT</span>
      </div>
      {dots.length > 1 && (
        <svg viewBox="0 0 110 44" className="w-full mt-1 rounded bg-white/5">
          {dots.slice(-60).map((d, i) => (
            <circle
              key={i}
              cx={6 + Math.min(98, (d.x / 1500) * 98)}
              cy={38 - Math.min(32, Math.max(0, ((d.y + 150) / 200) * 32))}
              r={1.3}
              fill={d.y < -50 ? "#f87171" : "#7dd3fc"}
              opacity={0.8}
            />
          ))}
          <text x={4} y={10} fontSize={6} fill="#64748b">AE→</text>
          <text x={4} y={40} fontSize={6} fill="#64748b">Dst↓</text>
        </svg>
      )}
      {dst.gst.length > 0 && (
        <div className="mt-1 text-[10px] text-slate-400">
          DONKI storms:{" "}
          {dst.gst.slice(0, 2).map((g) => (
            <span key={g.id} className="font-mono">
              Kp{g.kpMax}{" "}
              {g.link && (
                <a href={g.link} target="_blank" rel="noreferrer" className="text-cyan-400/80 hover:text-cyan-300">
                  CCMC
                </a>
              )}{" "}
            </span>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-500 leading-snug mt-2 pt-2 border-t border-white/10">
        Ring follows real Dst; Kyoto realtime comes from unverified raw data.
      </p>
    </PanelBox>
  );
}
