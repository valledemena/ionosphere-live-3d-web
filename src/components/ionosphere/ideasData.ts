"use client";

/** Catálogo de ideas exploradas con evaluación de adecuación.
 *  Contenido derivado de la revisión de código en profundidad del repositorio
 *  ionosphere-live-3d (C++/OpenGL) y de la verificación de fuentes de datos.
 *  Drop 350: estados reclasificados contra src/ del explorador web
 *  (auditoría con archivo:línea en 71_impl_350_mimo.md). Los textos de
 *  "Hallazgos" y "Fuentes" son el SNAPSHOT histórico de la revisión C++,
 *  no el estado actual en vivo.
 */

export interface IdeaItem {
  id: string;
  title: string;
  status: "demo" | "parcial" | "propuesta" | "aplazada"; // aplazada = fuera de paridad (poda 136), sin ciclo propio; parcial = núcleo implementado, falta explícita en `missing`
  impact: number; // 1-5
  effort: number; // 1-5
  category: "visual" | "fisica" | "datos" | "radio" | "ux";
  summary: string;
  detail: string;
  port?: string; // cómo portarlo al C++
  missing?: string; // obligatorio con status "parcial": qué falta exactamente
}

/** Fecha del snapshot de la revisión C++/fuentes (histórico, no en vivo;
 *  entró con ideasData en el baseline 259d5bd). */
export const REVIEW_SNAPSHOT = "2026-10-19";

/** Conteo por estado derivado de IDEAS (sin hardcodes). */
export function countIdeasByStatus(ideas: IdeaItem[] = IDEAS): Record<IdeaItem["status"], number> {
  const c: Record<IdeaItem["status"], number> = { demo: 0, parcial: 0, propuesta: 0, aplazada: 0 };
  for (const i of ideas) c[i.status]++;
  return c;
}


export const IDEAS: IdeaItem[] = [
  {
    id: "atm",
    title: "Real Rayleigh/Mie atmosphere (single scattering)",
    status: "demo",
    impact: 5,
    effort: 3,
    category: "visual",
    summary:
      "Replaces the fake Fresnel shell with physical scattering: blue sky, real red sunsets and a coherent limb.",
    detail:
      "Per-pixel raymarch (14×5 samples) over the back shell with exponential density (H_R 8.5 km, H_M 12 km), β_R (5.8,13.5,33.1)·10⁻⁶/m, asymmetric Mie g=0.76 and hard planet shadow. It is THE pending visual leap identified in the review: atmosphere.frag:12-21 is a constant-color shell, with no optical depth. In the current C++ the atmosphere never receives bloom nor feeds the limb halo.",
    port:
      "Replace shaders/atmosphere.frag: same model, 12 samples + 2D optical-depth LUT (Bruneton) if the iGPU struggles; add aerial perspective to earth.frag reusing the density.",
  },
  {
    id: "aur",
    title: "Volumetric aurora with instanced curtains",
    status: "demo",
    impact: 5,
    effort: 4,
    category: "visual",
    summary:
      "Animated 3D curtains on the real OVATION ring: 557.7 nm → 630 nm gradient, flicker and field-driven undulation.",
    detail:
      "~4000 instanced crossed quads, each one planted in its OVATION cell (real NOAA probability), oriented magnetic east-west, height 95-250 km scaled by probability. The C++ paints the oval as a flat-color ring (probability on the globe): the 'curtain' effect is the visual differentiator that the repo's own plan leaves as 'future physics'.",
    port:
      "Instanced rendering with glDrawElementsInstanced + per-instance attributes (iPos/iEast/iProb/iPhase); in GLFW/OpenGL 4.0 it is straightforward. The data is already downloaded (AuroraAdapter).",
  },
  {
    id: "hf",
    title: "Multi-hop HF ray tracing (real secant)",
    status: "demo",
    impact: 5,
    effort: 3,
    category: "radio",
    summary:
      "TX→RX circuits with real reflection arcs, MUF per reflection point, hops, elevation, LUF and band matrix.",
    detail:
      "The review detects that 'there is no hop model': the SliceLayer curtain shows Ne(h) but does not refract. Here: classic secant geometry (α = arccos(R·cosβ/(R+h′))), optimal hop count, MUF(D) = foF2·M(D) with M(D)=1490/(hmF2+216)·(D/3000)^0.24 (Dudeney + ITU-R P.1240), LUF with D absorption depending on the GOES X-ray (simplified Sauer-Wilkinson), and a 160-10 m band matrix in 'operator mode' style.",
    port:
      "App.cpp already has slerp/grid: add HFTraceLayer.cpp with a TubeGeometry equivalent (camera-facing ribbon) and a 'Circuit' panel. The hop formula is in src/lib/iono/hf.ts (Web) ready to port.",
  },
  {
    id: "rep",
    title: "Coherent time replay (sun follows the data)",
    status: "demo",
    impact: 3,
    effort: 1,
    category: "ux",
    summary:
      "In replay, the solar terminator and the daytime layers advance with the data epoch — a fix for the C++ inconsistency.",
    detail:
      "In the C++ the replayEpoch governs GIRO/grids/volume, but SolarPosition is fed from the wall clock: rewinding 3 h shows 'night data' with a daytime terminator. Here the sun is computed from the effective time. On top of that the GIRO getbest brings 6 h of history per station (72 samples @ 5 min) for scrubbing.",
    port:
      "App.cpp:1070-1141 — pass replayEpoch to SolarPosition::getDirection() and to applyDayNight (one line each).",
  },
  {
    id: "sdo",
    title: "Real SDO solar disk + geolocated active regions",
    status: "demo",
    impact: 3,
    effort: 2,
    category: "datos",
    summary:
      "Live HMIIF/AIA-304 image with the active regions (sunspot_report) marked at their heliographic coordinates.",
    detail:
      "The C++ draws a didactic disk with spots by Carrington rotation. The improvement: proxy of latest_512_HMIIF.jpg and latest_512_0304.jpg + region overlay with orthographic projection of heliographic lat/lon. Click toggles photosphere/chromosphere.",
    port:
      "XrayAdapter or a new SdoImageAdapter: curl + stb_image (already in libs/). The imgui HUD can show the texture.",
  },
  {
    id: "grd",
    title: "GIRO grid + weighted climatological background",
    status: "demo",
    impact: 4,
    effort: 2,
    category: "fisica",
    summary:
      "GIRO IDW with weight decreasing by great-circle distance, smoothly blended with a simplified CCIR model.",
    detail:
      "C++ problem: the global background median fills the oceans with values 'from another longitude' (the nocturnal F2 of the oceans inherits diurnal values). Blending by proximity w = smoothstep(55°,25°,dist) produces a physical transition between measurement and climate. It also fixes flat distance → haversine (large error at high latitudes).",
    port:
      "interpLayerProfiles (App.cpp:474-542): replace flat d with haversine and add the model term; ~40 lines.",
  },
  {
    id: "abs",
    title: "D absorption (Sauer-Wilkinson) integrated into LUF",
    status: "demo",
    impact: 4,
    effort: 2,
    category: "radio",
    summary:
      "A(dB) ∝ F^0.75 with live GOES X-ray + auroral component by Kp — fadeout alert in the radio panel.",
    detail:
      "The C++ LUF (RadioPropagationAdapter.cpp:78-96) uses a flat heuristic with no flare. Here the real GOES X-ray flux feeds absorption (SIDs enhance the D layer) and modulates LUF; a warning is raised when >1 dB on the circuit.",
    port:
      "Replace absorb in lufEstimate with the X-ray term of the flux that already arrives via XrayAdapter.",
  },
  {
    id: "pipe",
    title: "Linear pipeline: 4× MSAA in HDR + bloom + ACES",
    status: "demo",
    impact: 4,
    effort: 2,
    category: "visual",
    summary:
      "HalfFloat target with 4× MSAA, UnrealBloom with soft threshold, ACES tone mapping and fixed exposure 1.12.",
    detail:
      "The review finds: FBO without MSAA (aliasing on the shells), bloom with duplicated intensity in H+V (bloom.frag:22 → intensity²), hard threshold with no soft-knee and ACES with no sRGB management. The web pipeline fixes all four defects.",
    port:
      "Framebuffer.h: samples=4 on the scene RT; bloom.frag: u_intensity only in the vertical pass; composite: final sRGB encode.",
  },
  {
    id: "giro",
    title: "GIRO via getbest GET (polite) with history",
    status: "demo",
    impact: 3,
    effort: 1,
    category: "datos",
    summary:
      "51 stations with 6 h of history per single GET request instead of 129 massive POSTs every 5 min.",
    detail:
      "The C++ pool (16 threads, POST scaled.php) has no backoff and risks a ban (GiroAdapter.cpp:254-277). The fastchar/getbest endpoint returns the full series per station in a single call; with a 10 min cache and concurrency 6 + 250 ms pause the server appreciates it.",
    port:
      "GiroAdapter: GET to /fastchar/getbest with fromDate=now-6h — the parsing is identical (fixed-column lines) and history comes included.",
  },
  {
    id: "city",
    title: "Stars with a realistic Milky Way",
    status: "demo",
    impact: 2,
    effort: 1,
    category: "visual",
    summary: "6300 stars with a Gaussian galactic band, colors by temperature and red giants.",
    detail:
      "The C++ starfield is 1600 random points with no catalog. Here: physical band distribution + soft twinkling. Natural next step: embedded Hipparcos catalog (~9k stars, 200 KB) with diffraction spikes on those <2 mag.",
    port:
      "Stars.cpp: add the band (cross product of the galactic plane vectors) — 15 lines; Hipparcos as an attribute texture.",
  },

  // ─── propuestas promocionadas a demo/parcial en el drop 350 (auditoría src) ───
  {
    id: "god",
    title: "God rays / crepuscular rays from the real sun",
    status: "demo",
    impact: 4,
    effort: 3,
    category: "visual",
    summary: "Screen-space radial blur from the projected sun position, masked by the Earth depth.",
    detail:
      "Implemented in the web explorer: post-ACES pass with 12 radial taps and a CPU gate (lib/iono/godrays.ts + GOD shader in shaders.ts, assembled in IonosphereScene.tsx; toggleable 'God rays' layer in LayersPanel.tsx). A faithful mirror of the C++ pass (drops 143/147).",
    port: "Already ported: src/Utils/Godrays.h + GodraysPass in the C++ (drops 143/147).",
  },
  {
    id: "vol",
    title: "Volume: blue-noise jitter + empty-space skipping",
    status: "parcial",
    impact: 4,
    effort: 4,
    category: "visual",
    summary: "Removes raymarch banding and speeds up 2-3× by skipping empty cells.",
    detail:
      "IGN jitter (Jimenez 2014) of the entry point implemented and wired into the web march (lib/iono/volumeJitter.ts, entryOffset in volumeMarch.ts:133); 0.98/0.001 alpha early-outs active. Empty-space skipping with the R8 max mip exists neither here nor in the C++.",
    port:
      "Pass a 64×64 blue-noise texture + max mip of the R8; the loop already has an early exit.",
    missing: "empty-space skipping (per-cell max mip); jitter and early-outs already applied",
  },
  {
    id: "shadow",
    title: "Earth shadow over the ionospheric volume",
    status: "demo",
    impact: 5,
    effort: 2,
    category: "visual",
    summary: "Per-sample ray-sphere test (2-3 ops): the planet's shadow sweeps across the F-region in replay.",
    detail:
      "Implemented: shadowed() (lib/iono/volumeShadow.ts) evaluates ray-sphere per sample and is applied in the march (volumeMarch.ts:144 extinguishes the emission); tests certified in volumeShadow.test.ts. It visualizes the real ionospheric twilight (the F-region takes ~1 h to decay after sunset).",
    port: "Already ported: src/Utils/VolumeShadow.h (drop 133) inside the C++ raymarch.",
  },
  {
    id: "glow",
    title: "Chromatic airglow in the shell (557.7/630 nm)",
    status: "demo",
    impact: 3,
    effort: 2,
    category: "visual",
    summary: "Green→red gradient by hmF2 at the night limb, with fictitious single scattering modulated by density.",
    detail:
      "Drop 354 (TUNE1 tuning): IONO_FRAG blends soft bands by vHm — OI green 557.7 nm with smoothstep(215,290) km ×0.25 (max comparable to the 353 tweak) and OI red 630 nm with smoothstep(265,330) km ×0.85 (warm tone dominant at high hmF2) — modulated by a fictitious single scattering ss = fres × (1−dayAmount) × (0.35+0.65·f) (f = foF2 0..1) · shim. Only in the night/twilight hemisphere; day, colormap and opacity untouched, no additive clipping.",
    port:
      "IonosondeLayer/GridLayer shader: blend the airglow term according to vH (altitude) in the night hemisphere.",
  },
  {
    id: "iono",
    title: "Ionograms synthesized from the Ne(h) profile",
    status: "aplazada",
    impact: 5,
    effort: 4,
    category: "radio",
    summary: "Virtual h′(f) trace with O/X and Es modes for the pinned station; real GIRO vs model comparison.",
    detail:
      "With the Epstein/Chapman physics already implemented, synthesizing the trace is direct (group delay by integration of 1/(d(n)/dh)). The comparison panel (real SAO vs synthesized) would be a physical validator of the volume — pure teaching.",
    port: "App.cpp: new ImGui panel next to StationPanel; the group delay integral in DensityVolume.h.",
  },
  {
    id: "faraday",
    title: "Faraday with a real IGRF dipole",
    status: "demo",
    impact: 3,
    effort: 3,
    category: "fisica",
    summary: "Ω = K·∫Ne·B_par·dl/f² with an IGRF degree-1 dipole (2025.0), real 1/f² dependence and integration over the live volume.",
    detail:
      "Implemented (drop 356): pure module lib/iono/faraday.ts integrates Ne from the live density volume (sampleVolume, denormalized to m⁻³) and B_par of the IGRF dipole (degree 1, epoch 2025.0 frozen with no secular variation, in nT, scene frame) along the multi-hop HF path, per midpoint with 3D interpolation (robust to the antimeridian). Constant Ω_deg = 1.3522e-15·I/f_MHz² (B in nT); exact 1/f² dependence. Non-viable hops (viable=0) are filtered out; degenerate segments are discarded. Declared sign convention (it is not the astronomical RM). The IGRF degree-8 harmonic remains OUT of scope (it was ~80 coefficients); the degree-1 dipole captures the main physics.",
    port: "FaradayLayer.cpp + RadioPropagationAdapter.cpp:167-175 (stationOmegaRad → Utils/Igrf.h); the C++ engine already uses IGRF degree 8, the web one degree 1 (degree 8 out of scope).",
  },
  {
    id: "es",
    title: "Es (sporadic E) as a first-order layer",
    status: "aplazada",
    impact: 4,
    effort: 3,
    category: "radio",
    summary: "Global interpolated foEs map + 50 MHz opening alerts + Es routing in the ray trace.",
    detail:
      "Today foEs only lives in tooltips. Since foEs≥5 MHz opens 6 m/50 MHz, a map with alerts and the option to route the link through E (h′ 105 km) has real operational value for radio amateurs.",
    port: "getbest supports charName=foEs — same pipeline as foF2; additional GridLayer layer at 110 km.",
  },
  {
    id: "alert",
    title: "Configurable propagation alerts",
    status: "demo",
    impact: 4,
    effort: 2,
    category: "ux",
    summary: "Configurable red thresholds (Kp/Bz/X-ray/MUF), persisted, with toast notice and optional chime.",
    detail:
      "Engine + panel + live configuration (drop 353): AlertEngine accepts red AlertThresholds (kpRed/bzRed/xrayRedRank/mufRedDrop, defensively normalized) and setThresholds preserves the MUF history; the preferences (thresholds + toast + sound) persist in localStorage (ionosphere.alerts.prefs.v1) via useAlerts; the ALERTS panel offers sliders/select/checkboxes with Test/Reset and only notifies on upward transitions to AMBER/RED (no spam). A mirror of the C++ engine (drop 139) with its own web configuration layer.",
    port: "Already ported: src/Data/Alerts.h (drop 139); the configurable thresholds are a web extension (drop 353).",
  },
  {
    id: "pred",
    title: "24-48 h foF2/MUF prediction",
    status: "aplazada",
    impact: 5,
    effort: 4,
    category: "radio",
    summary: "Diurnal harmonic fit over the GIRO history + F10.7 outlook → time travel into the future.",
    detail:
      "The C++ replay only looks at the past. With the 24 h series per station (history) foF2(t) = a0 + a1·cos(ωt)+a2·sin(ωt)+a3·cos(2ωt)+a4·sin(2ωt) is fitted, modulated by the forecast F10.7 (3-day forecast), and the replay pipeline is reused in full for +24 h.",
    port: "sampleHistoryAt already interpolates; add a per-station fit in the worker and future frames to tecHist.",
  },
  {
    id: "export",
    title: "Data and video export of the replay",
    status: "demo",
    impact: 3,
    effort: 2,
    category: "ux",
    summary: "CSV of the foF2 grid with timestamp + PNG and a 15 s video clip of the canvas (turntable/cinema).",
    detail:
      "Implemented (drop 355): PNG and CSV of the last foF2 grid with the E key (mirror of the C++ Exporter: UTC names, %.9g, lib/iono/export.ts with tests) + 'Clip 15s' button in the header: records 15 s of the 3D canvas with MediaRecorder/captureStream and downloads the clip. Format VP8/VP9/WebM or MP4 depending on support (VP8 preferred at 4K; adaptive bitrate 4–25 Mbps; up to 30 fps depending on performance). Limitations: only the 3D canvas (no HUD), no audio, and the tab must stay visible during the recording.",
    port: "Capture pass at the end of the composite + GridData dump in the Timeline.",
  },
  {
    id: "tour",
    title: "Guided tour + ES/EN localization",
    status: "demo",
    impact: 4,
    effort: 2,
    category: "ux",
    summary: "Guided sequence: terminator → equatorial anomaly → aurora → storm, with text per step.",
    detail:
      "Implemented: keyframe queue (lib/iono/tour.ts, 4 segments/44 s with ES/EN texts) + HTML overlay with progress, ES/EN switch and closing (page.tsx; entry via the 'Guided tour' button or the T key). The camera is moved by IonosphereScene following the queue.",
    port: "Already ported: src/Utils/Tour.h (drop 137) with the keyframe queue.",
  },
];

/** Hallazgos de la revisión C++: SNAPSHOT histórico (REVIEW_SNAPSHOT),
 *  no el estado actual del explorador web. */
export const FINDINGS = [
  {
    title: "High-value bugs detected",
    items: [
      "broken resize: FBOs/camera are not resized (App.cpp:561)",
      "GIRO data race: getSamples() without lock vs thread pool (GiroAdapter.h:77)",
      "detached threads → use-after-free on shutdown (App.cpp:800-838)",
      "bloom intensity² by duplicating u_intensity in H and V (bloom.frag:22)",
      "CMake copies a non-existent data/ → POST_BUILD fails on a clean checkout",
      "NoaaAdapter/DataManager/UI stubs: dead code that confuses",
    ],
  },
  {
    title: "Strengths to preserve",
    items: [
      "Profile physics: Epstein-Bilitza with correct minimum analysis, diffusive topside",
      "Documented spherical convention, verified 3 ways (spec)",
      "Worker + immutable bundles: network and GL impeccably separated",
      "Replay with blendGrids + sampleHistoryAt (lerp respecting gaps)",
      "Honest fallbacks with 'simulated' flags visible in the UI",
    ],
  },
];

/** Fuentes de datos: estado verificado en REVIEW_SNAPSHOT (histórico del
 *  sandbox de la revisión), no una comprobación en vivo de hoy. */
export const DATA_SOURCES_STATUS = [
  { name: "NOAA Kp 1-min", ok: true, note: "planetary_k_index_1m.json · verified live" },
  { name: "NOAA OVATION aurora", ok: true, note: "924 KB per refresh, reduced to ~2k cells" },
  { name: "NOAA F10.7", ok: true, note: "f107_cm_flux.json + historical series" },
  { name: "NOAA solar wind (DSCOVR)", ok: true, note: "summary solar-wind-speed/mag-field (Bt, Bz live)" },
  { name: "GOES X-ray", ok: true, note: "xrays-6-hour.json · A/B/C/M/X class live" },
  { name: "NOAA sunspots", ok: true, note: "sunspot_report.json with heliographic lat/lon" },
  { name: "NOAA 3-day forecast", ok: true, note: "3-day-forecast.txt (max Kp + rationale)" },
  { name: "GIRO DIDBase", ok: true, note: "129 stations; getbest GET with 6 h history" },
  { name: "SDO images", ok: true, note: "HMIIF + AIA 304/193 (512 px, ~15 min)" },
  { name: "NOAA GloTEC (TEC)", ok: false, note: "index ~1 month stale and HTTP 202 frames — use as secondary" },
  { name: "D-RAP (D absorption)", ok: false, note: "public JSON retired/404 — computed with the Sauer-Wilkinson model + X-ray" },
  { name: "alerts.json / noaa-scales.json", ok: false, note: "intermittent 404 at snapshot time — scales are derived from Kp locally" },
];
