"use client";

import { useEffect, useRef, useState } from "react";
import { Satellite } from "lucide-react";
import { VoyagerData } from "../types";
import { PanelBox, SourceDot } from "./SpaceWeatherPanel";
import { pulseLapse, lightTimeSec } from "@/lib/iono/voyager";

/** W-4 F2b #7: Voyager panel (EN for all new UI).
 * Range refreshed from Horizons at runtime (O7) + Friis whisper with
 * public JPL params + HONEST pulse: the schematic sweeps in 10 s with
 * a VISIBLE factor (real one-way light time shown). DSN Robledo note. */
export default function VoyagerPanel({ voyager }: { voyager: VoyagerData | null }) {
  const [st, setSt] = useState<{ au: number | null; v: number | null }>({ au: null, v: null });
  const raf = useRef(0);
  const auKey = voyager?.au ?? null;
  const sweep = st.au === auKey ? st.v : null;

  useEffect(() => () => cancelAnimationFrame(raf.current), [auKey]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  if (!voyager || voyager.au == null || voyager.lightHours == null || voyager.prW == null) {
    return (
      <PanelBox title="Voyager">
        <div className="text-xs text-slate-500 py-6 text-center animate-pulse">
          {voyager ? "No Horizons range (honest, never fictitious)." : "Contacting JPL Horizons…"}
        </div>
      </PanelBox>
    );
  }
  const n = pulseLapse(lightTimeSec(voyager.au), 10000);
  const disp = sweep ?? 0;
  const startSweep = () => {
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const auAtStart = auKey;
    const step = (t: number) => {
      const f = Math.min(1, (t - t0) / 10000);
      setSt({ au: auAtStart, v: f });
      if (f < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  return (
    <PanelBox title="Voyager" badge={<SourceDot source={voyager.source} />}>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
          <Satellite size={12} /> Range
        </span>
        <span className="text-xs font-mono text-slate-200">{voyager.au.toFixed(3)} AU</span>
      </div>
      <div className="text-[10px] text-slate-500 font-mono">
        {voyager.date} · one-way light {voyager.lightHours.toFixed(1)} h · whisper {voyager.prW.toExponential(2)} W
      </div>
      {/* Pulse schematic Earth -> spacecraft (declared acceleration). */}
      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400">
        <span className="shrink-0 text-cyan-300">⊕</span>
        <div className="relative flex-1 h-1 rounded-full bg-white/10">
          <div
            className="absolute top-1/2 w-2 h-2 rounded-full bg-cyan-300"
            style={{ left: `calc(${(disp * 100).toFixed(1)}% - 4px)`, transform: "translateY(-50%)" }}
          />
        </div>
        <span className="shrink-0 text-slate-300"><Satellite size={11} /></span>
        <button
          onClick={startSweep}
          className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-200 hover:bg-white/20"
          title={`Real transit ${voyager.lightHours.toFixed(1)} h compressed to 10 s`}
        >
          ▶ ×{n}
        </button>
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5">
        Friis 23 W · 3.7 m · 8.42 GHz · DSN 70 m (public JPL params)
      </div>
      <p className="text-[10px] text-slate-500 leading-snug mt-2 pt-2 border-t border-white/10">
        DSN Madrid (Robledo) hears it too. Pulse honest: real time shown, sweep declared.
      </p>
    </PanelBox>
  );
}
