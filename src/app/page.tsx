"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RadioTower, FlaskConical, Github, X, Signal, Video } from "lucide-react";

import IonosphereScene from "@/components/ionosphere/IonosphereScene";
import SpaceWeatherPanel from "@/components/ionosphere/hud/SpaceWeatherPanel";
import CmePanel from "@/components/ionosphere/hud/CmePanel";
import FlarePanel from "@/components/ionosphere/hud/FlarePanel";
import WsprPanel from "@/components/ionosphere/hud/WsprPanel";
import GreyPanel from "@/components/ionosphere/hud/GreyPanel";
import FadePanel from "@/components/ionosphere/hud/FadePanel";
import LightningPanel from "@/components/ionosphere/hud/LightningPanel";
import AePanel from "@/components/ionosphere/hud/AePanel";
import DstPanel from "@/components/ionosphere/hud/DstPanel";
import BeltsPanel from "@/components/ionosphere/hud/BeltsPanel";
import SatellitePanel from "@/components/ionosphere/hud/SatellitePanel";
import ParkerPanel from "@/components/ionosphere/hud/ParkerPanel";
import VoyagerPanel from "@/components/ionosphere/hud/VoyagerPanel";
import MsisPanel from "@/components/ionosphere/hud/MsisPanel";
import LayersPanel from "@/components/ionosphere/hud/LayersPanel";
import RadioPanel from "@/components/ionosphere/hud/RadioPanel";
import TimeBar from "@/components/ionosphere/hud/TimeBar";
import Legend from "@/components/ionosphere/hud/Legend";
import IdeasPanel from "@/components/ionosphere/hud/IdeasPanel";
import { IDEAS } from "@/components/ionosphere/ideasData";
import { useVideoExport } from "@/hooks/use-video-export";

import {
  SpaceWeatherData,
  CmeData,
  FlareData,
  WsprData,
  LightningData,
  AeData,
  DstData,
  RbeData,
  VoyagerData,
  MsisData,
  AuroraData,
  IonosondeData,
  SceneSettings,
  replayAdvance,
} from "@/components/ionosphere/types";
import { LinkResult } from "@/lib/iono/hf";
import type { CatalogPayload } from "@/lib/iono/satellites/catalog";
import { RING_LABEL } from "@/lib/iono/satellites/ring1963";
import { type AlertSnapshot } from "@/lib/iono/alerts";
import type { AlertPrefs } from "@/lib/iono/alertPrefs";
import { useAlerts } from "@/hooks/use-alerts";
import { usePersistedSceneSettings } from "@/hooks/use-persisted-scene-settings";
import { tourCount, tourKey } from "@/lib/iono/tour";
import { getSunInfo } from "@/lib/iono/solar";
import { useNow } from "@/hooks/use-now";

async function fetchJson<T>(url: string, timeoutMs = 30000): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export default function Home() {
  const [sw, setSw] = useState<SpaceWeatherData | null>(null);
  // W-4 #1: pronostico ENLIL (CCMC DONKI, polling 10 min: las sims tardan horas).
  const [cme, setCme] = useState<CmeData | null>(null);
  // W-4 #3: catalogo DONKI FLR (mismo ritmo que ENLIL).
  const [flares, setFlares] = useState<FlareData | null>(null);
  // W-4 #5: spots WSPR (polling 5 min == TTL de la ruta).
  const [wspr, setWspr] = useState<WsprData | null>(null);
  // W-4 F2a #8: GLM granules + NWS storms (polling 5 min == TTL).
  const [lightning, setLightning] = useState<LightningData | null>(null);
  // W-4 F2a #17: Kyoto AE (polling 5 min; TTL de ruta 15 min, cache hits).
  const [ae, setAe] = useState<AeData | null>(null);
  // W-4 F2a #18: Kyoto Dst + GST (polling 5 min; TTL de ruta 15 min, cache hits).
  const [dst, setDst] = useState<DstData | null>(null);
  // W-4 F2a #19: DONKI RBE (polling 5 min; TTL de ruta 30 min, cache hits).
  const [rbe, setRbe] = useState<RbeData | null>(null);
  // W-4 F2b #7: JPL Horizons Voyager (polling 6 h == TTL de la ruta).
  const [voyager, setVoyager] = useState<VoyagerData | null>(null);
  // W-4 F2b #10: catalogo orbital vivo (polling 6 h == TTL de la ruta).
  // satDown = ultimo intento fallo en el cliente (ruta inalcanzable);
  // distinto de payload source="unavailable" (cadena agotada, hay hora).
  const [sat, setSat] = useState<CatalogPayload | null>(null);
  const [satDown, setSatDown] = useState(false);
  // W-4 F2b #9d: local NRLMSIS Tn/rho (polling 10 min; model is local).
  const [msis, setMsis] = useState<MsisData | null>(null);
  const [aurora, setAurora] = useState<AuroraData | null>(null);
  const [ionos, setIonos] = useState<IonosondeData | null>(null);
  const [settings, onSettingsChange] = usePersistedSceneSettings();
  const [txCode, setTxCode] = useState<string | null>(null);
  const [rxCode, setRxCode] = useState<string | null>(null);
  const [linkFreq, setLinkFreq] = useState(14.0);
  const [link, setLink] = useState<LinkResult | null>(null);
  const [legend, setLegend] = useState<{ min: number; max: number }>({ min: 2, max: 10 });
  const [fps, setFps] = useState(60);
  const [ideasOpen, setIdeasOpen] = useState(false);
  // P1-280: reloj client-only — el prerender estatico no fija hora
  // (evita mismatch de hidratacion React #418 con el HTML servido).
  const nowMs = useNow(1000) ?? 0;

  // W-2/W-353 alertas: motor, snapshot, prefs persistentes, toast y chime
  // encapsulados en useAlerts (contrato buildAlertInput sigue testeado).
  const {
    snap: alertSnap,
    prefs: alertPrefs,
    setPrefs: onAlertPrefsChange,
    testSound: onAlertTestSound,
  } = useAlerts(sw, ionos);
  // W-4 B1 slice: readout "A->B pk X.X" desde la escena.
  const [slicePeak, setSlicePeak] = useState<string | null>(null);

  // Drop 355: clip 15 s del canvas 3D (MediaRecorder). El canvas llega por
  // onCanvasReady (null en cleanup/StrictMode); el botón arranca deshabilitado
  // hasta que la escena monte el renderer (el canvas tarda tras las texturas).
  const [sceneCanvas, setSceneCanvas] = useState<HTMLCanvasElement | null>(null);
  const videoExport = useVideoExport(sceneCanvas);

  // W-2 tour: toggle T con reinicio a t=0 (la escena resetea su reloj al
  // activar); cualquier click en el canvas aborta sin salto de camara.
  const [tourOn, setTourOn] = useState(false);
  const [tourIdx, setTourIdx] = useState(0);
  const [tourEs, setTourEs] = useState(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "t" || e.key === "T") setTourOn((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ─── polling de datos ───
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const s = await fetchJson<SpaceWeatherData>("/api/space-weather");
      if (alive && s) setSw(s);
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const c = await fetchJson<CmeData>("/api/cme", 40000);
      if (alive && c) setCme(c);
      const f = await fetchJson<FlareData>("/api/flares", 40000);
      if (alive && f) setFlares(f);
    };
    load();
    const t = setInterval(load, 600_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const w = await fetchJson<WsprData>("/api/wspr", 40000);
      if (alive && w) setWspr(w);
      const l = await fetchJson<LightningData>("/api/lightning", 40000);
      if (alive && l) setLightning(l);
      const a = await fetchJson<AeData>("/api/ae", 40000);
      if (alive && a) setAe(a);
      const d = await fetchJson<DstData>("/api/dst", 40000);
      if (alive && d) setDst(d);
      const r = await fetchJson<RbeData>("/api/rbe", 40000);
      if (alive && r) setRbe(r);
    };
    load();
    const t = setInterval(load, 300_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const v = await fetchJson<VoyagerData>("/api/voyager", 60000);
      if (alive && v) setVoyager(v);
    };
    load();
    const t = setInterval(load, 21600_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const c = await fetchJson<CatalogPayload>("/api/satellites", 60000);
      if (!alive) return;
      if (c) {
        setSat(c);
        setSatDown(false);
      } else {
        setSatDown(true);
      }
    };
    load();
    const t = setInterval(load, 21600_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const m = await fetchJson<MsisData>("/api/msis", 60000);
      if (alive && m) setMsis(m);
    };
    load();
    const t = setInterval(load, 600_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const a = await fetchJson<AuroraData>("/api/aurora", 40000);
      if (alive && a) setAurora(a);
    };
    load();
    const t = setInterval(load, 300_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const i = await fetchJson<IonosondeData>("/api/ionosondes", 120_000);
      if (alive && i) setIonos(i);
    };
    load();
    const t = setInterval(load, 600_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  // ─── selección de estaciones: 1º TX, 2º RX, 3º reset ───
  const onStationPick = useCallback(
    (code: string | null) => {
      if (!code) return;
      if (!txCode) {
        setTxCode(code);
        setRxCode(null);
      } else if (!rxCode) {
        if (code === txCode) {
          setTxCode(null);
        } else setRxCode(code);
      } else {
        setTxCode(null);
        setRxCode(null);
      }
    },
    [txCode, rxCode]
  );

  // W-4 C2: avance automático del replay (espejo App.cpp:2139-2141).
  useEffect(() => {
    if (settings.timeMode !== "replay" || !settings.replayPlaying) return;
    const t = setInterval(() => {
      onSettingsChange({
        replayMinutes: replayAdvance(settings.replayMinutes, settings.replaySpeed, 0.5, 10080, settings.replayLoop),
      });
    }, 500);
    return () => clearInterval(t);
  }, [settings.timeMode, settings.replayPlaying, settings.replaySpeed, settings.replayLoop, settings.replayMinutes, onSettingsChange]);

  const effSec = useMemo(
    () => (nowMs - (settings.timeMode === "replay" ? settings.replayMinutes * 60_000 : 0)) / 1000,
    [settings.timeMode, settings.replayMinutes, nowMs]
  );
  // W-4 #1: el tablero y la escena usan el mismo epoch (replay determinista).
  const cmeEpoch = settings.timeMode === "replay" ? nowMs - settings.replayMinutes * 60_000 : nowMs;

  const tx = ionos?.stations.find((s) => s.code === txCode) ?? null;
  const rx = ionos?.stations.find((s) => s.code === rxCode) ?? null;

  // W-4 244 (ruling 243): render parcial — la escena tolera null; el
  // overlay solo cuando no hay NADA cargado (no por clase pendiente).
  const anyData = !!(sw || aurora || ionos);

  return (
    <main className="relative w-full h-screen overflow-hidden bg-[#02040a] select-none">
      {/* escena 3D */}
      <IonosphereScene
        spaceWeather={sw}
        cme={cme}
        wspr={wspr}
        lightning={lightning}
        ae={ae}
        dst={dst}
        rbe={rbe}
        aurora={aurora}
        ionosondes={ionos}
        satellites={sat}
        settings={settings}
        txCode={txCode}
        rxCode={rxCode}
        linkFreq={linkFreq}
        tourActive={tourOn}
        videoRecording={videoExport.recording}
        callbacks={{
          onStationPick,
          onLinkResult: setLink,
          onLegendRange: (min, max) => setLegend({ min, max }),
          onFps: setFps,
          onTourIndex: setTourIdx,
          onTourDone: () => setTourOn(false),
          onTourAbort: () => setTourOn(false),
          onSlicePeak: setSlicePeak,
          onCanvasReady: setSceneCanvas,
        }}
      />

      {/* cabecera */}
      <header className="absolute top-0 inset-x-0 z-20 pointer-events-none">
        <div className="flex items-start justify-between px-4 md:px-5 pt-3">
          <div className="pointer-events-auto">
            <h1
              className="text-sm md:text-base font-semibold text-slate-100 tracking-wide"
              style={{ fontFamily: "var(--font-display), ui-sans-serif" }}
            >
              IONOSPHERE LIVE 3D
              <span className="ml-2 text-[10px] font-normal uppercase tracking-[0.25em] text-cyan-400/70">
                web explorer
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
              <span className="font-mono tabular-nums" suppressHydrationWarning>{nowMs ? new Date(nowMs).toISOString().slice(11, 19) : "--:--:--"} UTC</span>
              <span className="w-1 h-1 rounded-full bg-cyan-400/60" />
              <span className="font-mono">
                subsolar {subsolar(new Date(effSec * 1000)).lat.toFixed(0)}{"\u00B0"} {subsolar(new Date(effSec * 1000)).lon >= 0 ? "E" : "W"}{" "}
                {Math.abs(subsolar(new Date(effSec * 1000)).lon).toFixed(0)}{"\u00B0"}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() =>
                videoExport.recording ? videoExport.stop() : videoExport.start(effSec)
              }
              disabled={!videoExport.supported || !sceneCanvas || videoExport.busy}
              title={
                !sceneCanvas
                  ? "Preparando escena 3D…"
                  : videoExport.recording
                    ? "Detener grabación"
                    : !videoExport.supported
                      ? "Grabación no soportada en este navegador"
                      : "Graba 15 s del canvas 3D (sin HUD ni audio; hasta 30 fps)"
              }
              className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/30 hover:bg-rose-500/25 transition-colors backdrop-blur-md disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Video size={13} />
              {videoExport.busy ? (
                <span>Procesando…</span>
              ) : videoExport.recording ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>REC {videoExport.secondsLeft}s</span>
                </>
              ) : (
                <span className="hidden sm:inline">Clip 15s</span>
              )}
            </button>
            <button
              onClick={() => setIdeasOpen(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-cyan-500/15 text-cyan-200 ring-1 ring-cyan-400/30 hover:bg-cyan-500/25 transition-colors backdrop-blur-md"
            >
              <FlaskConical size={13} />
              <span className="hidden sm:inline">Explorar ideas</span>
              <span className="sm:hidden">Ideas</span>
              <span className="text-[9px] bg-cyan-400/20 rounded-full px-1.5 py-0.5">{IDEAS.length}</span>
            </button>
            <a
              href="https://github.com/davidlopezsalvador/ionosphere-web"
              target="_blank"
              rel="noreferrer"
              className="text-slate-500 hover:text-slate-200 transition-colors p-2 rounded-xl hover:bg-white/5"
              title="Repositorio del proyecto (web)"
            >
              <Github size={16} />
            </a>
          </div>
        </div>
      </header>

      {/* paneles laterales */}
      <div className="absolute left-4 top-20 bottom-28 z-10 w-60 overflow-y-auto overscroll-contain pointer-events-auto space-y-3 hidden md:block pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.35)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/30 [&::-webkit-scrollbar-track]:bg-transparent" role="region" tabIndex={0} aria-label="Paneles de clima espacial (desplazable)">
        <SpaceWeatherPanel
          sw={sw}
          alerts={alertSnap}
          prefs={alertPrefs}
          onChangePrefs={onAlertPrefsChange}
          onTestSound={onAlertTestSound}
        />
        <CmePanel cme={cme} epochMs={cmeEpoch} />
        <FlarePanel sw={sw} flares={flares} epochMs={cmeEpoch} />
        <WsprPanel wspr={wspr} epochMs={cmeEpoch} />
        <GreyPanel wspr={wspr} epochMs={cmeEpoch} />
        <FadePanel sw={sw} epochMs={cmeEpoch} />
        <LightningPanel lightning={lightning} />
        <AePanel ae={ae} />
        <DstPanel dst={dst} ae={ae} />
        <BeltsPanel rbe={rbe} kp={sw ? sw.kp.now : 2} epochMs={cmeEpoch} />
        <SatellitePanel sat={sat} down={satDown} />
        <ParkerPanel sw={sw} />
        <VoyagerPanel voyager={voyager} />
        <MsisPanel msis={msis} />
      </div>
      <div className="absolute right-4 top-20 bottom-36 z-10 w-64 overflow-y-auto overscroll-contain pointer-events-auto space-y-3 hidden md:block pl-1 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.35)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400/30 [&::-webkit-scrollbar-track]:bg-transparent" role="region" tabIndex={0} aria-label="Capas y radio (desplazable)">
        <LayersPanel settings={settings} onChange={onSettingsChange} ionosondes={ionos} fps={fps} sw={sw ? sw.wind : null} />
        <RadioPanel link={link} tx={tx} rx={rx} freq={linkFreq} onFreq={setLinkFreq} sw={sw ? { kp: sw.kp.now, xray: sw.xray.now } : null} utcSec={effSec} settings={settings} onSettings={onSettingsChange} slicePeak={slicePeak} />
      </div>

      {/* móvil: paneles compactos colapsables */}
      <MobilePanels
        sw={sw}
        cme={cme}
        cmeEpoch={cmeEpoch}
        flares={flares}
        wspr={wspr}
        lightning={lightning}
        ae={ae}
        dst={dst}
        rbe={rbe}
        voyager={voyager}
        msis={msis}
        sat={sat}
        satDown={satDown}
        settings={settings}
        onChange={onSettingsChange}
        ionos={ionos}
        fps={fps}
        link={link}
        tx={tx}
        rx={rx}
        freq={linkFreq}
        onFreq={setLinkFreq}
        effSec={effSec}
        alerts={alertSnap}
        alertPrefs={alertPrefs}
        onAlertPrefsChange={onAlertPrefsChange}
        onAlertTestSound={onAlertTestSound}
        slicePeak={slicePeak}
      />

      {/* barra de tiempo inferior */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
        <TimeBar settings={settings} onChange={onSettingsChange} maxReplayMin={10080} />
      </div>

      {/* leyenda */}
      <div className="absolute bottom-4 right-4 z-10 hidden md:block">
        <Legend
          min={legend.min}
          max={legend.max}
          timestamp={
            settings.timeMode === "replay"
              ? `replay −${(settings.replayMinutes / 60).toFixed(1)} h`
              : ionos
              ? "live"
              : "…"
          }
          extras={settings.showRing1963 ? [RING_LABEL] : undefined}
        />
      </div>

      {/* indicador de selección TX/RX */}
      {/* W-2 tour: boton de entrada (tecla T equivalente) */}
      {!tourOn && (
        <button
          onClick={() => setTourOn(true)}
          className="absolute bottom-4 left-4 z-10 pointer-events-auto flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30 hover:bg-violet-500/25 transition-colors backdrop-blur-md"
        >
          Tour guiado <span className="text-[9px] bg-violet-400/20 rounded-full px-1.5 py-0.5">T</span>
        </button>
      )}

      {/* W-2 tour: overlay didactico HTML ES/EN (textos 137 verbatim) */}
      {tourOn && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 w-[min(92vw,30rem)] pointer-events-auto">
          <div className="rounded-xl border border-white/10 bg-[#0a0f1e]/85 backdrop-blur-md shadow-2xl shadow-black/40 px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-200/90">
                Visita guiada {tourIdx + 1}/{tourCount()}
              </span>
              <span className="flex items-center gap-1">
                <button
                  onClick={() => setTourEs((v) => !v)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-200 hover:bg-white/20"
                >
                  {tourEs ? "ES" : "EN"}
                </button>
                <button
                  onClick={() => setTourOn(false)}
                  className="text-slate-400 hover:text-slate-100 p-1 rounded-lg hover:bg-white/5"
                  title="Cerrar tour"
                >
                  <X size={13} />
                </button>
              </span>
            </div>
            <div className="flex gap-1.5 mt-1.5 mb-1">
              {Array.from({ length: tourCount() }, (_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full ${i <= tourIdx ? "bg-violet-400" : "bg-white/10"}`}
                />
              ))}
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              {tourEs ? tourKey(tourIdx).es : tourKey(tourIdx).en}
            </p>
          </div>
        </div>
      )}

      {(txCode || rxCode) && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="flex items-center gap-2 text-xs bg-[#0a0f1e]/85 backdrop-blur-md ring-1 ring-white/10 rounded-full px-3.5 py-1.5">
            {txCode ? (
              <span className="flex items-center gap-1 text-cyan-300 font-mono">
                <RadioTower size={11} /> {txCode}
              </span>
            ) : (
              <span className="text-slate-500">haz clic para TX</span>
            )}
            {rxCode ? (
              <span className="flex items-center gap-1 text-amber-300 font-mono">
                <Signal size={11} /> {rxCode}
              </span>
            ) : txCode ? (
              <span className="text-slate-500">· segundo clic = RX</span>
            ) : null}
            {txCode && rxCode && (
              <button
                className="pointer-events-auto text-slate-500 hover:text-red-300 transition-colors"
                onClick={() => {
                  setTxCode(null);
                  setRxCode(null);
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* overlay de carga inicial (solo sin ningún dato) */}
      {!anyData && (
        <div className="absolute inset-0 z-30 bg-[#02040a]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400/20" />
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
            <div className="absolute inset-3 rounded-full bg-cyan-400/10 animate-pulse" />
          </div>
          <p className="text-xs text-slate-400 tracking-wide">
            Conectando con NOAA SWPC · GIRO · SDO…
          </p>
          <div className="flex gap-2 text-[10px]">
            <StatusChip ok={!!sw} label="clima espacial" />
            <StatusChip ok={!!aurora} label="aurora" />
            <StatusChip ok={!!ionos} label="ionosondas" />
          </div>
        </div>
      )}

      <IdeasPanel open={ideasOpen} onClose={() => setIdeasOpen(false)} />

      {/* pie: fuentes (P1-245a: atribución kc2g GIRO/WWROF/eSWua) */}
      {!tourOn && (
        <footer className="absolute bottom-16 left-4 z-10 text-[9px] text-slate-600 pointer-events-none hidden lg:block leading-relaxed">
          NOAA SWPC · GIRO DIDBase (CC BY-NC-SA 4.0) · SDO (NASA/SDO &amp; AIA, HMI consortium)
          <br />
          Fallback kc2g (GIRO/WWROF/eSWua) · Exploración derivada del repositorio C++ ionosphere-live-3d
        </footer>
      )}
    </main>
  );
}

function StatusChip({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`flex items-center gap-1.5 px-2 py-1 rounded-full ring-1 ${
        ok ? "bg-emerald-500/10 text-emerald-300 ring-emerald-400/30" : "bg-white/5 text-slate-500 ring-white/10"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-slate-600 animate-pulse"}`} />
      {label}
    </span>
  );
}

function subsolar(now: Date) {
  // Unificado con getSunInfo (ruling 174 n1, fix 175): una sola fuente para
  // el punto subsolar (antes: aproximacion propia que contradecia al decode).
  const s = getSunInfo(now.getTime() / 1000);
  return { lat: s.subsolarLat, lon: s.subsolarLon };
}

/** En móvil: paneles en pestañas colapsables */
function MobilePanels({
  sw,
  cme,
  cmeEpoch,
  flares,
  wspr,
  lightning,
  ae,
  dst,
  rbe,
  voyager,
  msis,
  sat,
  satDown,
  settings,
  onChange,
  ionos,
  fps,
  link,
  tx,
  rx,
  freq,
  onFreq,
  effSec,
  alerts,
  alertPrefs,
  onAlertPrefsChange,
  onAlertTestSound,
  slicePeak,
}: {
  sw: SpaceWeatherData | null;
  cme: CmeData | null;
  cmeEpoch: number;
  flares: FlareData | null;
  wspr: WsprData | null;
  lightning: LightningData | null;
  ae: AeData | null;
  dst: DstData | null;
  rbe: RbeData | null;
  voyager: VoyagerData | null;
  msis: MsisData | null;
  sat: CatalogPayload | null;
  satDown: boolean;
  settings: SceneSettings;
  onChange: (p: Partial<SceneSettings>) => void;
  ionos: IonosondeData | null;
  fps: number;
  link: LinkResult | null;
  tx: { code: string; name: string; lat: number; lon: number } | null;
  rx: { code: string; name: string; lat: number; lon: number } | null;
  freq: number;
  onFreq: (f: number) => void;
  effSec: number;
  alerts: AlertSnapshot | null;
  alertPrefs: AlertPrefs;
  onAlertPrefsChange: (patch: Partial<AlertPrefs>) => void;
  onAlertTestSound: () => void;
  slicePeak: string | null;
}) {
  const [tab, setTab] = useState<"wx" | "radio" | "layers" | null>(null);
  return (
    <div className="md:hidden absolute left-3 right-3 top-16 z-10">
      <div className="flex gap-1.5 mb-2 pointer-events-auto">
        {(
          [
            ["wx", "Clima"],
            ["radio", "Radio"],
            ["layers", "Capas"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(tab === id ? null : id)}
            className={`text-[11px] px-3 py-1.5 rounded-lg backdrop-blur-md transition-colors ${
              tab === id
                ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/30"
                : "bg-[#0a0f1e]/80 text-slate-400 ring-1 ring-white/10"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "wx" && (
        <>
          <SpaceWeatherPanel
            sw={sw}
            alerts={alerts}
            prefs={alertPrefs}
            onChangePrefs={onAlertPrefsChange}
            onTestSound={onAlertTestSound}
          />
          <div className="mt-2">
            <CmePanel cme={cme} epochMs={cmeEpoch} />
          </div>
          <div className="mt-2">
            <FlarePanel sw={sw} flares={flares} epochMs={cmeEpoch} />
          </div>
          <div className="mt-2">
            <WsprPanel wspr={wspr} epochMs={cmeEpoch} />
          </div>
          <div className="mt-2">
            <GreyPanel wspr={wspr} epochMs={cmeEpoch} />
          </div>
          <div className="mt-2">
            <FadePanel sw={sw} epochMs={cmeEpoch} />
          </div>
          <div className="mt-2">
            <LightningPanel lightning={lightning} />
          </div>
          <div className="mt-2">
            <AePanel ae={ae} />
          </div>
          <div className="mt-2">
            <DstPanel dst={dst} ae={ae} />
          </div>
          <div className="mt-2">
            <BeltsPanel rbe={rbe} kp={sw ? sw.kp.now : 2} epochMs={cmeEpoch} />
          </div>
          <div className="mt-2">
            <SatellitePanel sat={sat} down={satDown} />
          </div>
          <div className="mt-2">
            <ParkerPanel sw={sw} />
          </div>
          <div className="mt-2">
        <VoyagerPanel voyager={voyager} />
        <MsisPanel msis={msis} />
          </div>
        </>
      )}
      {tab === "radio" && (
        <RadioPanel
          link={link}
          tx={tx as never}
          rx={rx as never}
          freq={freq}
          onFreq={onFreq}
          sw={sw ? { kp: sw.kp.now, xray: sw.xray.now } : null}
          utcSec={effSec}
          settings={settings}
          onSettings={onChange}
          slicePeak={slicePeak}
        />
      )}
      {tab === "layers" && (
        <LayersPanel settings={settings} onChange={onChange} ionosondes={ionos} fps={fps} sw={sw ? sw.wind : null} />
      )}
    </div>
  );
}
