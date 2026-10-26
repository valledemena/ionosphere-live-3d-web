"use client";

import { Layers, Cloud, Star, Sparkles, Radio, Orbit, Mountain, Eye, Disc3, Sun, Boxes, Circle, Rocket, Zap, Sunrise, CloudRainWind, Activity, Donut, Satellite, CircleDot } from "lucide-react";
import { SceneSettings, IonosondeData } from "../types";
import { dynamicPressure, shueR0, tailStretch } from "@/lib/iono/magnetosphere";
import { PanelBox, SourceDot } from "./SpaceWeatherPanel";

interface Props {
  settings: SceneSettings;
  onChange: (patch: Partial<SceneSettings>) => void;
  ionosondes: IonosondeData | null;
  fps: number;
  sw?: {
    bz: number;
    speed: number;
    density: number;
  } | null;
}

/** W-4 #4: readout vivo r0/Dp + cola declarada (O4.6). */
function MagnetoReadout({
  sw,
}: {
  sw?: { bz: number; speed: number; density: number } | null;
}) {
  if (!sw || !(sw.speed > 0)) return <span>Bz/Dp: sin viento</span>;
  const n = sw.density > 0 ? sw.density : 5;
  const Dp = dynamicPressure(n, sw.speed);
  const r0 = shueR0(sw.bz, Dp);
  return (
    <span>
      r0 {r0.toFixed(1)} R_E · Dp {Dp.toFixed(1)} nPa · cola ×{tailStretch(sw.bz).toFixed(2)} (param)
    </span>
  );
}

/** Panel de capas y controles visuales */
export default function LayersPanel({ settings, onChange, ionosondes, fps, sw }: Props) {
  const n = ionosondes?.stations.length ?? 0;
  const withData = ionosondes?.stations.filter((s) => (s.foF2 ?? 0) > 0).length ?? 0;
  return (
    <PanelBox title="Capas" badge={<span className="text-[10px] text-slate-500 font-mono">{fps.toFixed(0)} fps</span>}>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <Toggle
          icon={<Cloud size={12} />}
          label="Nubes"
          checked={settings.clouds}
          onChange={(v) => onChange({ clouds: v })}
        />
        <Toggle
          icon={<Star size={12} />}
          label="Estrellas"
          checked={settings.showStars}
          onChange={(v) => onChange({ showStars: v })}
        />
        <Toggle
          icon={<Sparkles size={12} />}
          label="Aurora"
          checked={settings.showAurora}
          onChange={(v) => onChange({ showAurora: v })}
        />
        <Toggle
          icon={<Radio size={12} />}
          label="Enlace HF"
          checked={settings.showLink}
          onChange={(v) => onChange({ showLink: v })}
        />
        <Toggle
          icon={<Orbit size={12} />}
          label="Modo cine"
          checked={settings.cinema}
          onChange={(v) => onChange({ cinema: v })}
        />
        <Toggle
          icon={<Disc3 size={12} />}
          label="Shell foF2"
          checked={settings.showShell}
          onChange={(v) => onChange({ showShell: v })}
        />
        <Toggle
          icon={<Sun size={12} />}
          label="God rays"
          checked={settings.showGodrays}
          onChange={(v) => onChange({ showGodrays: v })}
        />
        <Toggle
          icon={<Boxes size={12} />}
          label="Volumen"
          checked={settings.showVolume}
          onChange={(v) => onChange({ showVolume: v })}
        />
        <Toggle
          icon={<Eye size={12} />}
          label="Ionosondas"
          checked={settings.showStations}
          onChange={(v) => onChange({ showStations: v })}
        />
        <Toggle
          icon={<Orbit size={12} />}
          label="Ref shells"
          checked={settings.showRings}
          onChange={(v) => onChange({ showRings: v })}
        />
        <Toggle
          icon={<Layers size={12} />}
          label="Iso bands"
          checked={settings.showIso}
          onChange={(v) => onChange({ showIso: v })}
        />
        <Toggle
          icon={<Mountain size={12} />}
          label="Etiquetas"
          checked={settings.showLabels}
          onChange={(v) => onChange({ showLabels: v })}
        />
        <Toggle
          icon={<Orbit size={12} />}
          label="Magnetosfera"
          checked={settings.showMagnetosphere}
          onChange={(v) => onChange({ showMagnetosphere: v })}
        />
        <Toggle
          icon={<Rocket size={12} />}
          label="CME ENLIL"
          checked={settings.showCme}
          onChange={(v) => onChange({ showCme: v })}
        />
        <Toggle
          icon={<Zap size={12} />}
          label="Flash X-ray"
          checked={settings.showFlare}
          onChange={(v) => onChange({ showFlare: v })}
        />
        <Toggle
          icon={<Radio size={12} />}
          label="WSPRnet"
          checked={settings.showWspr}
          onChange={(v) => onChange({ showWspr: v })}
        />
        <Toggle
          icon={<Sunrise size={12} />}
          label="Grey line"
          checked={settings.showGreyline}
          onChange={(v) => onChange({ showGreyline: v })}
        />
        <Toggle
          icon={<CloudRainWind size={12} />}
          label="Fadeout"
          checked={settings.showFadeout}
          onChange={(v) => onChange({ showFadeout: v })}
        />
        <Toggle
          icon={<Zap size={12} />}
          label="Lightning"
          checked={settings.showLightning}
          onChange={(v) => onChange({ showLightning: v })}
        />
        <Toggle
          icon={<Activity size={12} />}
          label="Electrojets"
          checked={settings.showAe}
          onChange={(v) => onChange({ showAe: v })}
        />
        <Toggle
          icon={<Circle size={12} />}
          label="Dst ring"
          checked={settings.showDst}
          onChange={(v) => onChange({ showDst: v })}
        />
        <Toggle
          icon={<Donut size={12} />}
          label="Belts"
          checked={settings.showBelts}
          onChange={(v) => onChange({ showBelts: v })}
        />
        {/* W-4 F2b #10 (ruling 320): eco 2026 vivo + anillo 1963 declarado. */}
        <Toggle
          icon={<Satellite size={12} />}
          label="Eco 2026"
          checked={settings.showSatellites}
          onChange={(v) => onChange({ showSatellites: v })}
        />
        <Toggle
          icon={<CircleDot size={12} />}
          label="Anillo 1963"
          checked={settings.showRing1963}
          onChange={(v) => onChange({ showRing1963: v })}
        />
      </div>
      {settings.showMagnetosphere && (
        <div className="mt-1 text-[10px] font-mono text-slate-400">
          <MagnetoReadout sw={sw} />
        </div>
      )}

      <Slider
        icon={<Mountain size={12} />}
        label="Exageración alt."
        value={settings.exaggeration}
        min={1}
        max={5}
        step={0.1}
        format={(v) => `${v.toFixed(1)}×`}
        onChange={(v) => onChange({ exaggeration: v })}
      />
      <Slider
        icon={<Layers size={12} />}
        label="Opacidad shell"
        value={settings.shellOpacity}
        min={0.1}
        max={1}
        step={0.05}
        format={(v) => `${(v * 100).toFixed(0)}%`}
        onChange={(v) => onChange({ shellOpacity: v })}
      />

      <div className="mt-2 pt-2 border-t border-white/10 text-[11px] text-slate-400 flex items-center justify-between">
        <span>Ionosondas GIRO</span>
        <span className="flex items-center gap-1.5">
          <SourceDot source={ionosondes ? ionosondes.source : ""} />
          {withData}/{n}
        </span>
      </div>

      {/* W-4 E-tail o6: tamaño de punto (App.cpp:4293 SliderFloat 3-30). */}
      {/* W-4 E-tail o6: tamaño de punto (rango útil 3-15; más allá
          satura el techo y no cambia nada). */}
      <Slider
        icon={<Circle size={12} />}
        label="Point size"
        value={settings.pointSize}
        min={3}
        max={15}
        step={1}
        format={(v) => `${v.toFixed(0)}`}
        onChange={(v) => onChange({ pointSize: v })}
      />

      {/* W-4 F2: modo Chapman + escala de opacidad (App.cpp:4219-4227). */}
      <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-1">
        {(["density", "chapman"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onChange({ volumeMode: m })}
            title={
              m === "density"
                ? "Color por densidad electronica del volumen."
                : "Modelo Chapman de capas ionosfericas."
            }
            aria-label={
              m === "density"
                ? "Density: color por densidad electronica"
                : "Chapman: modelo de capas ionosfericas"
            }
            aria-pressed={settings.volumeMode === m}
            className={`text-[10px] px-2 py-1 rounded-md ring-1 transition-colors ${
              settings.volumeMode === m
                ? "bg-cyan-500/20 text-cyan-200 ring-cyan-400/40"
                : "bg-white/5 text-slate-400 ring-transparent hover:bg-white/10"
            }`}
          >
            {m === "density" ? "Density" : "Chapman"}
          </button>
        ))}
      </div>

      <Slider
        icon={<Boxes size={12} />}
        label="Opacidad volumen"
        value={settings.volumeOpacity}
        min={0}
        max={2.5}
        step={0.1}
        format={(v) => `${v.toFixed(1)}x`}
        onChange={(v) => onChange({ volumeOpacity: v })}
      />
    </PanelBox>
  );
}

const TOGGLE_HINTS: Record<string, string> = {
  Nubes: "Capa de nubes troposfericas con textura dia/noche.",
  Estrellas: "Fondo estrellado; desactivalo para ver la escena sobre negro.",
  Aurora: "Ovalos aurorales y emision en latitudes altas.",
  "Enlace HF": "Trazado del enlace entre ionosondas: saltos, MUF y absorcion.",
  "Modo cine": "Rotacion automatica de la camara alrededor del globo.",
  "Shell foF2": "Superficie de foF2 derivada de las ionosondas.",
  "God rays": "Rayos crepusculares y dispersion volumetrica del Sol.",
  Volumen: "Volumen 3D de densidad electronica reconstruido.",
  Ionosondas: "Estaciones GIRO y sus etiquetas; sirven de origen/destino HF.",
  "Ref shells": "Cascaras de referencia a altitudes ionosfericas fijas.",
  "Iso bands": "Isolineas de frecuencia critica y bandas de propagacion.",
  Etiquetas: "Etiquetas geograficas y de estaciones.",
  Magnetosfera: "Magnetopausa, lineas dipolares y viento solar animado.",
  "CME ENLIL": "Frente de CME y llegada geoefectiva segun ENLIL.",
  "Flash X-ray": "Destello solar y absorcion ionosferica asociada (SID).",
  WSPRnet: "Arcos de spots WSPR de transmisor a receptor por banda.",
  "Grey line": "Terminador solar y franja de propagacion en el crepusculo.",
  Fadeout: "Atenuacion y absorcion de la senal HF (PCA y region D).",
  Lightning: "Tormentas NWS, trazas whistler y sprites conjugados.",
  Electrojets: "Corriente electrojet auroral y actividad AE.",
  "Dst ring": "Anillo de corriente ecuatorial y valor Dst.",
  Belts: "Cinturones de Van Allen: protones internos y electrones externos.",
  "Eco 2026": "Nube de satelites en orbita a partir de elementos TLE.",
  "Anillo 1963": "Anillo de particulas West Ford 1963, ilustrativo.",
};

function Toggle({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const hint = TOGGLE_HINTS[label] ?? label;
  return (
    <button
      onClick={() => onChange(!checked)}
      title={hint}
      aria-label={`${label}: ${hint}`}
      aria-pressed={checked}
      className={`flex items-center gap-1.5 text-xs rounded-lg px-2 py-1.5 transition-colors ${
        checked
          ? "bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30"
          : "bg-white/5 text-slate-500 hover:bg-white/10 ring-1 ring-transparent"
      }`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      <span
        className={`w-1.5 h-1.5 rounded-full ${checked ? "bg-cyan-300" : "bg-slate-600"}`}
      />
    </button>
  );
}

function Slider({
  icon,
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          {icon} {label}
        </span>
        <span className="text-slate-200 font-mono">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full mt-1 h-1.5 rounded-full appearance-none cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan-300
          [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(34,211,238,0.6)]
          [&::-webkit-slider-runnable-track]:bg-white/10
          bg-white/10"
      />
    </div>
  );
}
