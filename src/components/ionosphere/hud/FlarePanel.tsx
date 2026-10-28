"use client";

import { Zap, TriangleAlert } from "lucide-react";
import { SpaceWeatherData, FlareData } from "../types";
import { PanelBox, SourceDot } from "./SpaceWeatherPanel";
import { flareState, matchFlr, type FlrEvent } from "@/lib/iono/flare";
import { dRegionAbsorptionDb } from "@/lib/iono/ionomath";
import { useNow } from "@/hooks/use-now";

/** W-4 #3: panel flare -> SID.
 * El estado sale de la serie GOES viva (O3.1, determinista en replay);
 * la fisica D es `dRegionAbsorptionDb` de la demo abs (O3.2, sin duplicar);
 * el cross-check DONKI FLR cubre la ventana del replay (O3.4); el cierre
 * con #5 se DECLARA pendiente porque WSPRnet no ha aterrizado (O3.5). */
export default function FlarePanel({
  sw,
  flares,
  epochMs,
}: {
  sw: SpaceWeatherData | null;
  flares: FlareData | null;
  epochMs: number;
}) {
  const now = useNow();
  if (!sw || now === null) {
    return (
      <PanelBox title="Flare / SID">
        <div className="text-xs text-slate-500 py-6 text-center animate-pulse">
          Waiting for GOES X-ray…
        </div>
      </PanelBox>
    );
  }
  const st = flareState(sw.xray.series, epochMs);
  // SID subsolar con el flujo del epoch (O3.2: misma funcion que demo abs).
  const fluxNow = st.peak > 0 ? st.peak : 0;
  const sidDb = dRegionAbsorptionDb(1, fluxNow, 0);
  const win: [number, number] =
    sw && epochMs < now - 60_000
      ? [epochMs - 12 * 3600_000, epochMs] // replay: ventana de 12 h
      : [now - 24 * 3600_000, now]; // vivo: ultimas 24 h
  const flrList: FlrEvent[] = flares
    ? matchFlr(
        flares.flares.map((f) => ({
          flrId: f.flrId,
          begin: f.begin,
          peak: f.peak,
          end: f.end,
          classType: f.classType,
          srcLoc: f.srcLoc,
          ar: f.ar,
          link: f.link,
        })),
        win[0],
        win[1]
      )
    : [];

  const hot = st.isEvent;
  return (
    <PanelBox
      title="Flare / SID"
      badge={<SourceDot source={sw.xray.source} />}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
          <Zap size={12} /> 3 h peak
        </span>
        <span className={`font-mono font-semibold ${hot ? "text-red-400" : "text-emerald-400"}`}>
          {st.cls}
        </span>
      </div>
      {/* barra de nivel log C1->0, X1->1 */}
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
        <div
          className={`h-full ${hot ? "bg-red-400" : "bg-emerald-500"}`}
          style={{ width: `${(st.level * 100).toFixed(0)}%` }}
        />
      </div>
      <div className="text-[10px] text-slate-500 mt-0.5">
        {st.peakTime
          ? `peak ${new Date(st.peakTime).toISOString().slice(5, 16).replace("T", " ") + "Z"}`
          : "no peak in window"}
        {hot && fluxNow > 0 ? ` · SID subsolar ${sidDb.toFixed(1)} dB (demo abs)` : ""}
      </div>

      {hot && (
        <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-red-300/90 leading-snug">
          <TriangleAlert size={11} className="shrink-0 mt-0.5" />
          <span>
            Dayside flash + SID active (they follow the real terminator; the
            X-ray engine only fires with live data).
          </span>
        </div>
      )}

      {/* O3.4: cross-check DONKI FLR en la ventana */}
      <div className="mt-1.5 pt-1.5 border-t border-white/10">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">
          DONKI FLR {flares ? `(${flrList.length} in window)` : "(no data)"}
        </div>
        {flrList.slice(0, 3).map((f) => (
          <div key={f.flrId} className="flex items-center justify-between mt-0.5 text-[10px]">
            <span className="text-slate-300 font-mono">
              {f.classType ?? "?"} · {f.srcLoc ?? "?"} {f.ar != null ? `AR${f.ar}` : ""}
            </span>
            {f.link && (
              <a href={f.link} target="_blank" rel="noreferrer" className="text-cyan-400/80 hover:text-cyan-300">
                CCMC
              </a>
            )}
          </div>
        ))}
        {flares && flrList.length === 0 && (
          <div className="text-[10px] text-slate-600">No DONKI flares in the window.</div>
        )}
      </div>
      {/* O3.5: cierre con #5 (P1-260: #5 aterrizó en el 259). */}
      <div className="text-[10px] text-slate-600 mt-1">
        Closure with #5 (WSPRnet): active — see WSPRnet panel.
      </div>
    </PanelBox>
  );
}
