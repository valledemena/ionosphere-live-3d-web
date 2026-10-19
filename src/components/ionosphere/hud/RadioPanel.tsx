"use client";

import { Radio, ArrowRight, Info } from "lucide-react";
import { LinkResult, HF_BANDS, bandStatus } from "@/lib/iono/hf";
import { IonosondeStation, SceneSettings } from "../types";
import { PanelBox } from "./SpaceWeatherPanel";
import { dRegionAbsorptionDb, lufEstimate } from "@/lib/iono/ionomath";
import { solarZenithDeg } from "@/lib/iono/solar";

interface Props {
  link: LinkResult | null;
  tx: IonosondeStation | null;
  rx: IonosondeStation | null;
  freq: number;
  onFreq: (f: number) => void;
  sw: { kp: number; xray: number } | null;
  utcSec: number;
  settings: SceneSettings;
  onSettings: (p: Partial<SceneSettings>) => void;
  slicePeak: string | null;
}

/** Panel de radio: enlace TX→RX con MUF/LUF/FOT y matriz de bandas */
export default function RadioPanel({ link, tx, rx, freq, onFreq, sw, utcSec, settings, onSettings, slicePeak }: Props) {
  const slice = (
    <SliceSection settings={settings} onSettings={onSettings} slicePeak={slicePeak} hasLink={!!(tx && rx)} />
  );
  if (!tx || !rx || !link) {
    return (
      <PanelBox title="Radio · enlace HF">
        <div className="text-xs text-slate-500 py-4 text-center leading-relaxed">
          <Radio size={20} className="mx-auto mb-2 text-slate-600" />
          Haz clic en dos ionosondas del globo
          <br />
          (1ª = <span className="text-cyan-300">TX</span>, 2ª ={" "}
          <span className="text-amber-300">RX</span>) para trazar el circuito.
        </div>
        {slice}
      </PanelBox>
    );
  }

  // LUF en el punto de reflexión más crítico
  const mid = link.hops[Math.floor(link.hops.length / 2)].reflexion;
  const zen = solarZenithDeg(mid.lat, mid.lon, utcSec);
  const cosChi = Math.cos((zen * Math.PI) / 180);
  const luf = lufEstimate(link.mufLink, cosChi, sw?.xray ?? 1e-8, link.mufLink / 3.2);
  const absorb = dRegionAbsorptionDb(cosChi, sw?.xray ?? 1e-8, sw?.kp ?? 2);

  return (
    <PanelBox title="Radio · enlace HF">
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono text-cyan-300">{tx.code}</span>
        <span className="text-slate-500 truncate flex-1">{tx.name}</span>
        <ArrowRight size={12} className="text-slate-600" />
        <span className="font-mono text-amber-300">{rx.code}</span>
        <span className="text-slate-500 truncate flex-1">{rx.name}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 my-2.5 text-center">
        <Metric label="Distancia" value={`${link.distanceKm.toFixed(0)}`} unit="km" />
        <Metric label="Saltos" value={`${link.hops.length}`} unit="× ~2.9 Mm" />
        <Metric label="Elevación" value={`${link.hops[0].elevationDeg.toFixed(1)}`} unit="°" />
        <Metric label="MUF(3000)F2" value={link.mufLink.toFixed(1)} unit="MHz" accent="text-cyan-300" />
        <Metric label="FOT" value={link.fotLink.toFixed(1)} unit="MHz" accent="text-emerald-300" />
        <Metric label="LUF est." value={luf.toFixed(1)} unit="MHz" accent="text-orange-300" />
      </div>

      {absorb > 1 && (
        <div className="flex items-start gap-1.5 text-[10px] text-amber-300/90 bg-amber-500/10 rounded-lg px-2 py-1.5 mb-2">
          <Info size={11} className="mt-0.5 shrink-0" />
          Absorción D estimada {absorb.toFixed(1)} dB en el circuito (X-ray {sw?.xray.toExponential(1)} W/m²)
        </div>
      )}

      {/* matriz de bandas */}
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
        Bandas — frecuencia de trabajo: {freq.toFixed(1)} MHz
      </div>
      <div className="flex items-center gap-1 mb-2">
        <input
          type="range"
          min={1.8}
          max={30}
          step={0.1}
          value={freq}
          onChange={(e) => onFreq(parseFloat(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer bg-white/10
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-300"
        />
      </div>
      <div className="grid grid-cols-5 gap-1">
        {HF_BANDS.map((b) => {
          const st = bandStatus(b.f, link.mufLink, link.fotLink, luf);
          const cls =
            st === "open"
              ? "bg-emerald-500/20 text-emerald-300 ring-emerald-400/40"
              : st === "marginal"
              ? "bg-amber-500/20 text-amber-300 ring-amber-400/40"
              : "bg-red-500/15 text-red-400/70 ring-red-400/20";
          return (
            <div
              key={b.name}
              className={`text-center text-[10px] font-medium rounded-md px-1 py-1 ring-1 ${cls} ${
                Math.abs(b.f - freq) < 1.5 ? "ring-2" : ""
              }`}
            >
              {b.name}
            </div>
          );
        })}
      </div>

      <div className="mt-2 pt-1.5 border-t border-white/10 text-[10px] text-slate-500">
        Rumbo {link.bearingAB}° / retorno {link.bearingBA}° · h′ virtual {link.virtualHeight.toFixed(0)} km ·
        MUF/Dudeney M(D)=1490/(hmF2+216)·(D/3000)^0.24 · FOT = 0.85·MUF
      </div>
      {slice}
    </PanelBox>
  );
}

/** W-4 B1: cortina slice QTH-DX (espejo App.cpp:4245-4260). */
function SliceSection({
  settings,
  onSettings,
  slicePeak,
  hasLink,
}: {
  settings: SceneSettings;
  onSettings: (p: Partial<SceneSettings>) => void;
  slicePeak: string | null;
  hasLink: boolean;
}) {
  const num = (label: string, value: number, key: "sliceLatA" | "sliceLonA" | "sliceLatB" | "sliceLonB", min: number, max: number) => (
    <label className="flex items-center gap-1 text-[10px] text-slate-400">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={0.5}
        value={value}
        onChange={(e) => onSettings({ [key]: parseFloat(e.target.value) } as Partial<SceneSettings>)}
        className="w-16 bg-white/5 rounded px-1 py-0.5 text-slate-200 font-mono"
      />
    </label>
  );
  return (
    <div className="mt-2 pt-1.5 border-t border-white/10">
      <label className="flex items-center gap-1.5 text-xs text-slate-200 cursor-pointer">
        <input
          type="checkbox"
          checked={settings.showSlice}
          onChange={(e) => onSettings({ showSlice: e.target.checked })}
          className="accent-cyan-400"
        />
        Path slice
        {slicePeak && <span className="ml-auto font-mono text-[10px] text-cyan-300">{slicePeak}</span>}
      </label>
      {settings.showSlice && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          <div className="flex gap-1">
            {(["link", "manual", "fixed"] as const).map((m) => (
              <button
                key={m}
                onClick={() => onSettings({ sliceSrc: m })}
                disabled={m !== "manual" && m !== "fixed" && !hasLink}
                className={`text-[10px] px-2 py-1 rounded-md ring-1 transition-colors ${
                  settings.sliceSrc === m
                    ? "bg-cyan-500/20 text-cyan-200 ring-cyan-400/40"
                    : "bg-white/5 text-slate-400 ring-transparent hover:bg-white/10"
                }`}
              >
                {m === "link" ? "Enlace" : m === "manual" ? "Manual A/B" : "Fijo ±2°"}
              </button>
            ))}
          </div>
          {settings.sliceSrc !== "link" && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {num("A lat", settings.sliceLatA, "sliceLatA", -90, 90)}
              {num("A lon", settings.sliceLonA, "sliceLonA", -180, 180)}
              {settings.sliceSrc === "manual" && (
                <>
                  {num("B lat", settings.sliceLatB, "sliceLatB", -90, 90)}
                  {num("B lon", settings.sliceLonB, "sliceLonB", -180, 180)}
                </>
              )}
            </div>
          )}
          {settings.sliceSrc === "link" && !hasLink && (
            <div className="text-[10px] text-slate-500">Necesita enlace TX→RX (o usa Manual A/B).</div>
          )}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  unit,
  accent = "text-slate-100",
}: {
  label: string;
  value: string;
  unit: string;
  accent?: string;
}) {
  return (
    <div className="bg-white/5 rounded-lg py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-sm font-semibold ${accent}`}>
        {value}
        <span className="text-[9px] text-slate-500 ml-0.5 font-normal">{unit}</span>
      </div>
    </div>
  );
}
