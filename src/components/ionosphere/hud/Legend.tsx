"use client";

/** Leyenda de la variable mostrada (foF2, TECU-style colormap) */
import { colormapCss, ColormapName } from "@/lib/iono/colormaps";

export default function Legend({
  min,
  max,
  cmap = "viridis",
  label = "foF2 (MHz)",
  timestamp,
  extras,
}: {
  min: number;
  max: number;
  cmap?: ColormapName;
  label?: string;
  timestamp: string;
  /** W-4 F2b #10: avisos de capas declaradas (p.ej. anillo 1963). */
  extras?: string[];
}) {
  return (
    <div
      className="pointer-events-auto rounded-xl border border-white/10 bg-[#0a0f1e]/80 backdrop-blur-md px-3 py-2 w-52 shadow-2xl"
      style={{ fontFamily: "var(--font-display), ui-sans-serif, system-ui" }}
    >
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] uppercase tracking-widest text-cyan-200/80">{label}</span>
        <span className="text-[9px] text-slate-500 font-mono">{timestamp}</span>
      </div>
      <div
        className="h-2.5 rounded-md ring-1 ring-white/15"
        style={{ background: colormapCss(cmap, 48) }}
      />
      <div className="flex justify-between mt-0.5 text-[10px] text-slate-400 font-mono tabular-nums">
        <span>{min.toFixed(1)}</span>
        <span>{((min + max) / 2).toFixed(1)}</span>
        <span>{max.toFixed(1)}</span>
      </div>
      <div className="text-[9px] text-slate-600 mt-1 leading-tight">
        GIRO + climatological background · shell at real hmF2
      </div>
      {extras?.map((x) => (
        <div key={x} className="text-[9px] text-amber-200/80 mt-0.5 leading-tight">
          {x}
        </div>
      ))}
    </div>
  );
}
