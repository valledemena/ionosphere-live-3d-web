"use client";

import { useState } from "react";
import { Activity, Sun, Wind, Zap, Globe2 } from "lucide-react";
import { SpaceWeatherData } from "../types";
import { sourceBadge } from "@/lib/iono/fallback";
import Sparkline from "./Sparkline";

/** Panel de clima espacial: Kp, F10.7, viento solar, GOES X-ray + disco solar SDO */
export default function SpaceWeatherPanel({
  sw,
  alerts,
}: {
  sw: SpaceWeatherData | null;
  alerts?: import("@/lib/iono/alerts").AlertSnapshot | null;
}) {
  const [solarImg, setSolarImg] = useState(true);
  if (!sw) {
    return (
      <PanelBox title="Clima espacial">
        <div className="text-xs text-slate-500 py-6 text-center animate-pulse">
          Conectando con NOAA SWPC…
        </div>
      </PanelBox>
    );
  }

  const kp = sw.kp.now;
  const gLabel = ["G0 Quieta", "G1 Menor", "G2 Moderada", "G3 Fuerte", "G4 Severa", "G5 Extrema"][
    sw.kp.gScale
  ];
  const kpColor =
    kp >= 7 ? "text-red-400" : kp >= 5 ? "text-orange-400" : kp >= 3 ? "text-yellow-300" : "text-emerald-400";

  const bzColor = sw.wind.bz < -5 ? "text-red-400" : sw.wind.bz < 0 ? "text-orange-300" : "text-emerald-400";
  const xr = sw.xray;

  return (
    <PanelBox title="Clima espacial" badge={<SourceDot source={sw.kp.source} />}>
      {/* Kp */}
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
          <Activity size={12} /> Índice Kp
        </span>
        <span className={`text-lg font-semibold ${kpColor}`}>{kp.toFixed(2)}</span>
      </div>
      {/* barra Kp 0-9 segmentada */}
      <div className="flex gap-[3px] mb-2">
        {Array.from({ length: 9 }, (_, i) => {
          const lvl = Math.min(1, Math.max(0, kp - i));
          const c =
            i + 1 <= 4 ? "bg-emerald-500" : i + 1 <= 5 ? "bg-yellow-400" : i + 1 <= 6 ? "bg-orange-500" : "bg-red-500";
          return (
            <div key={i} className="h-1.5 flex-1 rounded-sm bg-white/10 overflow-hidden">
              <div className={`h-full ${c}`} style={{ width: `${lvl * 100}%`, opacity: 0.55 + lvl * 0.45 }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-[11px] text-slate-500">{gLabel}</span>
        <Sparkline data={sw.kp.series.map((p) => p.kp)} width={110} height={22} color="#22d3ee" min={0} max={9} />
      </div>

      {/* F10.7 + manchas */}
      <StatRow
        icon={<Sun size={12} />}
        label="F10.7"
        value={`${sw.f107.now ? sw.f107.now.toFixed(0) : "—"} sfu`}
        extra={`${sw.sunspots.regions.length} AR`}
        spark={sw.f107.series.map((p) => p.f)}
        sparkColor="#fbbf24"
      />

      {/* viento solar */}
      <StatRow
        icon={<Wind size={12} />}
        label="Viento solar"
        value={`${sw.wind.speed} km/s`}
        extra={
          <>
            Bt {sw.wind.bt} nT · Bz{" "}
            <span className={bzColor}>{sw.wind.bz >= 0 ? "+" : ""}{sw.wind.bz}</span> nT
          </>
        }
      />

      {/* GOES X-ray */}
      <div className="flex items-center justify-between mt-1.5">
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400">
          <Zap size={12} /> GOES X-ray
        </span>
        <span
          className={`font-mono font-semibold ${
            xr.class.startsWith("X")
              ? "text-red-400"
              : xr.class.startsWith("M")
              ? "text-orange-400"
              : "text-emerald-400"
          }`}
        >
          {xr.class}
        </span>
      </div>
      <div className="scale-95 origin-left -mb-1">
        <Sparkline
          data={xr.series.map((p) => Math.log10(Math.max(p.f, 1e-9)))}
          width={118}
          height={20}
          color="#f472b6"
        />
      </div>
      <div className="text-[10px] text-slate-500 text-right -mt-0.5 mb-1">escala log · 6 h</div>

      {/* disco solar con manchas reales posicionadas */}
      <button
        onClick={() => setSolarImg(!solarImg)}
        className="mt-1 w-full flex items-center gap-3 group"
        title="SDO/HMI — clic para alternar AIA 304 (cromosfera)"
      >
        <div className="relative w-16 h-16 shrink-0 rounded-full overflow-hidden ring-1 ring-amber-200/30 group-hover:ring-amber-200/60 transition">
          
          {/* eslint-disable-next-line @next/next/no-img-element -- imagen remota viva; sin optimizador a propósito */}
          <img
            src={`/api/solar-image?type=${solarImg ? "hmi" : "aia304"}`}
            alt="Disco solar en tiempo real (SDO)"
            className="w-full h-full object-cover"
          />
          {/* marcadores de regiones activas */}
          {sw.sunspots.regions.slice(0, 12).map((r) => {
            // lon heliográfica: E/W invertidas; proyección ortográfica
            const x = 50 - (r.lon / 180) * 40;
            const y = 50 - (r.lat / 90) * 40;
            if (r.lon > 90 || r.lon < -90) return null;
            return (
              <span
                key={r.region}
                className="absolute w-1.5 h-1.5 rounded-full bg-cyan-300 ring-1 ring-cyan-100/80"
                style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)" }}
                title={`AR ${r.region} (${r.loc})`}
              />
            );
          })}
        </div>
        <div className="text-[10px] leading-snug text-slate-500 text-left">
          <div className="text-slate-300 font-medium">{solarImg ? "SDO · HMI (fotosfera)" : "SDO · AIA 304 (cromosfera)"}</div>
          <div>Regiones activas: {sw.sunspots.regions.length}</div>
          <div>· clic para alternar ·</div>
        </div>
      </button>

      {/* forecast */}
      {sw.forecast.maxKp !== null && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Globe2 size={12} /> Próximas 72 h
          </div>
          <p className="text-[11px] text-slate-300 leading-snug mt-0.5">
            Kp máx previsto <span className="text-cyan-300 font-medium">{sw.forecast.maxKp}</span>
            {sw.forecast.note ? ` — ${sw.forecast.note.slice(0, 150)}` : ""}
          </p>
        </div>
      )}
      {alerts && <AlertsSection alerts={alerts} />}
    </PanelBox>
  );
}

/** W-2 alertas: semaforo sobre bundles publicados + ultimas transiciones. */
import { RULE_NAMES, type AlertSnapshot } from "@/lib/iono/alerts";

const LVL_TXT = ["GREEN", "AMBER", "RED", "OFF"] as const;
const LVL_CLS = ["text-emerald-400", "text-amber-300", "text-red-400", "text-slate-500"] as const;

function AlertsSection({ alerts }: { alerts: AlertSnapshot }) {
  const evs = alerts.events.slice(-6).reverse();
  return (
    <div className="mt-2 pt-2 border-t border-white/10">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-slate-400">Alertas</span>
        <span className={`text-[11px] font-semibold ${LVL_CLS[alerts.overall]}`}>
          {LVL_TXT[alerts.overall]}
        </span>
      </div>
      {RULE_NAMES.map((n, r) => (
        <div key={n} className="flex items-center justify-between mt-0.5">
          <span className="text-[11px] text-slate-500">{n}</span>
          <span className={`text-[11px] font-medium ${LVL_CLS[alerts.levels[r]]}`}>
            {LVL_TXT[alerts.levels[r]]}
          </span>
        </div>
      ))}
      {evs.map((ev, i) => (
        <div key={`${ev.utc}-${i}`} className="text-[10px] text-slate-600">
          {RULE_NAMES[ev.rule]} {LVL_TXT[ev.from]} -&gt; {LVL_TXT[ev.to]}
        </div>
      ))}
    </div>
  );
}

function StatRow({  icon,
  label,
  value,
  extra,
  spark,
  sparkColor = "#22d3ee",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  extra?: React.ReactNode;
  spark?: number[];
  sparkColor?: string;
}) {
  return (
    <div className="flex items-center justify-between mt-1.5 gap-2">
      <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-400 min-w-0">
        {icon} <span className="truncate">{label}</span>
      </span>
      <span className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-slate-200 font-medium">{value}</span>
        {extra && <span className="text-[10px] text-slate-500">{extra}</span>}
        {spark && spark.length > 2 && <Sparkline data={spark} width={56} height={16} color={sparkColor} />}
      </span>
    </div>
  );
}

export function PanelBox({
  title,
  badge,
  children,
  className = "",
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`pointer-events-auto rounded-xl border border-white/10 bg-[#0a0f1e]/80 backdrop-blur-md shadow-2xl shadow-black/40 ${className}`}
      style={{ fontFamily: "var(--font-display), ui-sans-serif, system-ui" }}
    >
      <header className="flex items-center justify-between px-3.5 pt-2.5 pb-1.5 border-b border-white/10">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/90">{title}</h2>
        {badge}
      </header>
      <div className="px-3.5 pb-3 pt-1">{children}</div>
    </section>
  );
}

export function SourceDot({ source }: { source: string }) {
  // W-4 244: 5 estados de fuente (ruling 243); mapeo puro en fallback.ts.
  const b = sourceBadge(source);
  const cls =
    b.tone === "green"
      ? "text-emerald-400"
      : b.tone === "amber"
        ? "text-amber-300"
        : b.tone === "blue"
          ? "text-sky-400"
          : b.tone === "red"
            ? "text-red-400"
            : "text-slate-500";
  const dot =
    b.tone === "green"
      ? "bg-emerald-400 animate-pulse"
      : b.tone === "amber"
        ? "bg-amber-300"
        : b.tone === "blue"
          ? "bg-sky-400"
          : b.tone === "red"
            ? "bg-red-400"
            : "bg-slate-600";
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-wider ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {b.label}
    </span>
  );
}
