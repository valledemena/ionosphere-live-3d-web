"use client";

import { useEffect, useState } from "react";
import { Clock, Play, Pause, RotateCcw, Repeat } from "lucide-react";
import {
  SceneSettings,
  replaySliderOffset,
  timeBarClockLabel,
  timeBarEffectiveMinutes,
} from "../types";

const SPEEDS = [0.5, 1, 2, 4, 8];

interface Props {
  settings: SceneSettings;
  onChange: (patch: Partial<SceneSettings>) => void;
  maxReplayMin: number;
}

/** Barra de tiempo: LIVE vs REPLAY (historia GIRO 168 h, W-4 C1) */
export default function TimeBar({ settings, onChange, maxReplayMin }: Props) {
  const [scrubbing, setScrubbing] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    setNowMs(Date.now());
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const replay = settings.timeMode === "replay";
  const minutesBack = replaySliderOffset(maxReplayMin, settings.replayMinutes); // 0 = −max (izq) · max = «ahora» (der)
  const effMin = timeBarEffectiveMinutes(settings.timeMode, settings.replayMinutes);

  return (
    <div
      className="pointer-events-auto rounded-xl border border-white/10 bg-[#0a0f1e]/85 backdrop-blur-md shadow-2xl px-3 py-2 flex items-center gap-3"
      style={{ fontFamily: "var(--font-display), ui-sans-serif, system-ui" }}
    >
      <button
        onClick={() => onChange({ timeMode: replay ? "live" : "replay", replayMinutes: 0 })}
        className={`flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-2.5 py-1.5 transition-colors ${
          replay ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/40" : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/40"
        }`}
        title="Alternar LIVE / REPLAY"
      >
        {replay ? <Pause size={12} /> : <Play size={12} />}
        {replay ? "REPLAY" : "LIVE"}
      </button>

      <div className="flex items-center gap-1.5 text-slate-400">
        <Clock size={13} />
        <span className="font-mono text-xs tabular-nums text-slate-200" suppressHydrationWarning>
          {timeBarClockLabel(nowMs, effMin)}
        </span>
      </div>

      <div className="relative w-56 md:w-72">
        <input
          type="range"
          min={0}
          max={maxReplayMin}
          step={5}
          value={minutesBack}
          disabled={!replay}
          onPointerDown={() => setScrubbing(true)}
          onPointerUp={() => setScrubbing(false)}
          onChange={(e) => {
            const back = replaySliderOffset(maxReplayMin, parseFloat(e.target.value));
            onChange({ timeMode: back > 0 ? "replay" : "live", replayMinutes: back });
          }}
          className={`w-full h-1.5 rounded-full appearance-none cursor-pointer transition-opacity ${
            replay ? "opacity-100 bg-gradient-to-r from-cyan-500/30 to-emerald-400/40" : "opacity-30 bg-white/10"
          }
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-300
            [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(34,211,238,0.7)]`}
        />
        <div className="flex justify-between text-[9px] text-slate-600 mt-0.5 select-none">
          <span>−{maxReplayMin / 60} h</span>
          <span>{scrubbing ? "hist. GIRO · 5 min/frame" : "ahora"}</span>
        </div>
      </div>

      {settings.replayMinutes > 0 && (
        <button
          onClick={() => onChange({ timeMode: "live", replayMinutes: 0 })}
          className="text-slate-400 hover:text-cyan-300 transition-colors"
          title="Volver a tiempo real"
        >
          <RotateCcw size={13} />
        </button>
      )}

      {/* W-4 C2: reproducción automática (espejo replayPlaying/Speed/loop). */}
      {replay && (
        <>
          <button
            onClick={() => onChange({ replayPlaying: !settings.replayPlaying })}
            className={`transition-colors ${
              settings.replayPlaying ? "text-amber-300 hover:text-amber-200" : "text-slate-400 hover:text-cyan-300"
            }`}
            title={settings.replayPlaying ? "Pausar" : "Reproducir"}
          >
            {settings.replayPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <button
            onClick={() => {
              const i = SPEEDS.indexOf(settings.replaySpeed);
              onChange({ replaySpeed: SPEEDS[(i + 1) % SPEEDS.length] });
            }}
            className="font-mono text-[10px] text-slate-400 hover:text-cyan-300 transition-colors"
            title="Velocidad (x20 min/s a 1x)"
          >
            {settings.replaySpeed}x
          </button>
          <button
            onClick={() => onChange({ replayLoop: !settings.replayLoop })}
            className={`transition-colors ${
              settings.replayLoop ? "text-cyan-300 hover:text-cyan-200" : "text-slate-600 hover:text-slate-400"
            }`}
            title="Bucle 168 h"
          >
            <Repeat size={13} />
          </button>
        </>
      )}
    </div>
  );
}
