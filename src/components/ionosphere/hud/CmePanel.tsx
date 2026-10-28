"use client";

import { useEffect, useRef, useState } from "react";
import { Sun, Rocket, TriangleAlert } from "lucide-react";
import { CmeData } from "../types";
import { PanelBox, SourceDot } from "./SpaceWeatherPanel";
import { cmeProgress, cmeArrived, cmeCountdown, lapseFactor } from "@/lib/iono/cme";

const LASCO_C2 = "https://soho.nascom.nasa.gov/data/realtime/c2/512/latest.jpg";

/** W-4 #1: tablero solar — frente CME con ETA ENLIL + encadenado O1.3.
 * El frente vive AQUI (esquema Sol->Tierra), no en la escena 3D: la escala
 * de 1 UA es incompatible con la vista en R_E — declarado (ver nota 255).
 * El transito de 1-3 dias se muestra con barrido acelerado y factor VISIBLE
 * (O1.5); el frente NO simula plasma (O1.2, texto exacto del ruling 252). */
export default function CmePanel({ cme, epochMs }: { cme: CmeData | null; epochMs: number }) {
  const [st, setSt] = useState<{ simId: string | null; v: number | null }>({ simId: null, v: null });
  const [lascoOk, setLascoOk] = useState(true);
  const raf = useRef(0);
  const simId = cme?.event?.simId ?? null;
  const sweep = st.simId === simId ? st.v : null;

  useEffect(() => () => cancelAnimationFrame(raf.current), [simId]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  if (!cme) {
    return (
      <PanelBox title="Solar dashboard">
        <div className="text-xs text-slate-500 py-6 text-center animate-pulse">
          Querying CCMC…
        </div>
      </PanelBox>
    );
  }

  const startSweep = (target: number) => {
    cancelAnimationFrame(raf.current);
    const t0 = performance.now();
    const dur = 8000;
    const idAtStart = simId;
    const step = (t: number) => {
      const f = Math.min(1, (t - t0) / dur);
      setSt({ simId: idAtStart, v: target * f });
      if (f < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  };

  return (
    <PanelBox title="Solar dashboard" badge={<SourceDot source={cme.source} />}>
      {cme.status === "unknown" && (
        <div className="text-[11px] text-slate-500 py-3 text-center">
          No ENLIL data (CCMC not responding) — a fictitious CME is never shown.
        </div>
      )}
      {cme.status === "quiet" && (
        <div className="text-[11px] text-slate-300 leading-snug">
          <span className="text-emerald-400 font-medium">No geoeffective event.</span>
          <div className="text-slate-500 mt-0.5">
            Last sim {cme.modelTime ? new Date(cme.modelTime).toISOString().slice(0, 16).replace("T", " ") + "Z" : "—"}
            {" · "}{cme.simCount} sims in window
          </div>
        </div>
      )}
      {cme.status === "event" && cme.event && (
        <EventBody cme={cme} epochMs={epochMs} sweep={sweep} onSweep={startSweep} lascoOk={lascoOk} onLascoError={() => setLascoOk(false)} />
      )}
      {/* O1.2: declaracion ENLIL exacta del ruling 252, siempre visible */}
      <p className="text-[10px] text-slate-500 leading-snug mt-2 pt-2 border-t border-white/10">
        The front visualizes the CCMC ENLIL forecast; it is not our own simulation.
      </p>
    </PanelBox>
  );
}

function EventBody({
  cme, epochMs, sweep, onSweep, lascoOk, onLascoError,
}: {
  cme: CmeData;
  epochMs: number;
  sweep: number | null;
  onSweep: (target: number) => void;
  lascoOk: boolean;
  onLascoError: () => void;
}) {
  const ev = cme.event!;
  const live = cmeProgress(ev.start, ev.arrival, epochMs);
  const disp = sweep ?? live;
  const arrived = cmeArrived(ev.start, ev.arrival, epochMs);
  const n = lapseFactor(ev.start, ev.arrival);
  const geoCol = ev.earthGB ? (arrived ? "text-red-400" : "text-orange-300") : "text-slate-400";

  return (
    <div>
      {/* esquema Sol -> frente -> Tierra */}
      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
        <span className="flex items-center gap-1 shrink-0"><Sun size={11} className="text-amber-300" /> SUN</span>
        <div className="relative flex-1 h-1.5 rounded-full bg-white/10 overflow-visible">
          <div className="absolute inset-y-0 left-0 rounded-full bg-orange-400/70" style={{ width: `${disp * 100}%` }} />
          <div
            className="absolute top-1/2 w-2.5 h-2.5 rounded-full bg-orange-300 ring-2 ring-orange-100/60"
            style={{ left: `calc(${(disp * 100).toFixed(1)}% - 5px)`, transform: "translateY(-50%)" }}
            title={`Front at ${(disp * 100).toFixed(0)}% of transit`}
          />
        </div>
        <span className="shrink-0 text-cyan-300">⊕ EARTH</span>
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className={`text-xs font-semibold ${arrived && ev.earthGB ? "text-red-400" : "text-slate-200"}`}>
          {arrived ? (ev.earthGB ? "ENLIL ARRIVAL" : "Passed by") : `ETA ${cmeCountdown(ev.arrival, epochMs)}`}
        </span>
        <button
          onClick={() => onSweep(live)}
          className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-200 hover:bg-white/20"
          title={`Compresses the real transit to 8 s (factor ×${n})`}
        >
          ▶ transit ×{n}
        </button>
      </div>
      {sweep !== null && (
        <div className="text-[10px] text-slate-500">time ×{n} (8 s sweep, O1.5)</div>
      )}

      {/* parámetros ENLIL (O1.4: de la propia sim, entrada más exacta) */}
      <div className="grid grid-cols-3 gap-x-2 gap-y-0.5 mt-1.5 text-[10px]">
        <span className="text-slate-500">v</span>
        <span className="col-span-2 text-slate-200 font-mono">{ev.speed != null ? `${ev.speed} km/s` : "—"}</span>
        <span className="text-slate-500">half-width ½</span>
        <span className="col-span-2 text-slate-200 font-mono">{ev.halfAngle != null ? `${ev.halfAngle}°` : "—"}</span>
        <span className="text-slate-500">origin</span>
        <span className="col-span-2 text-slate-200 font-mono">
          {ev.srcLat != null ? `${ev.srcLat}°, ${ev.srcLon}°` : "—"}
        </span>
        {ev.kpMax != null && (
          <>
            <span className="text-slate-500">Kp ENLIL</span>
            <span className="col-span-2 text-slate-200 font-mono">up to {ev.kpMax}</span>
          </>
        )}
      </div>

      {/* O1.3: encadenado mínimo visible */}
      {arrived && ev.earthGB && (
        <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-red-300/90 leading-snug">
          <TriangleAlert size={11} className="shrink-0 mt-0.5" />
          <span>
            Compression #4 ×1.6 (declared demo) · oval ON · the alert engine
            (live Kp/Bz) only fires with the real storm.
          </span>
        </div>
      )}
      <div className="text-[10px] text-slate-600 mt-1">
        Future chain F2 (declared): fadeout #2 · Forbush #14 · Dst #18.
      </div>

      {/* O1.4: textura LASCO del momento, con fallback honesto */}
      {lascoOk ? ( // eslint-disable-next-line @next/next/no-img-element -- imagen remota viva; sin optimizador a propósito
        <img
          src={LASCO_C2}
          alt="LASCO C2 in real time (SOHO)"
          className="mt-1.5 w-full rounded-lg ring-1 ring-white/10"
          loading="lazy"
          onError={onLascoError}
        />
      ) : (
        <div className="mt-1.5 text-[10px] text-slate-500">No LASCO image for this moment.</div>
      )}
      <div className="flex items-center justify-between mt-1">
        <span className={`text-[10px] font-mono ${geoCol}`}>
          {ev.earthGB ? "geoeffective" : "not geoeffective"} · {ev.simId}
        </span>
        {ev.link && (
          <a href={ev.link} target="_blank" rel="noreferrer" className="text-[10px] text-cyan-400/80 hover:text-cyan-300">
            view on CCMC
          </a>
        )}
      </div>
      <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
        <Rocket size={10} /> start {ev.start ? new Date(ev.start).toISOString().slice(5, 16).replace("T", " ") + "Z" : "—"}
        {" → "}arrival {new Date(ev.arrival).toISOString().slice(5, 16).replace("T", " ") + "Z"}
      </div>
    </div>
  );
}
