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
    title: "Atmósfera Rayleigh/Mie real (single scattering)",
    status: "demo",
    impact: 5,
    effort: 3,
    category: "visual",
    summary:
      "Sustituye la cáscara Fresnel falsa por dispersión física: cielo azul, atardeceres rojos reales y limbo coherente.",
    detail:
      "Raymarch por píxel (14×5 muestras) sobre la cáscara trasera con densidad exponencial (H_R 8.5 km, H_M 12 km), β_R (5.8,13.5,33.1)·10⁻⁶/m, Mie asimétrica g=0.76 y sombra dura del planeta. Es EL salto visual pendiente identificado en la revisión: atmosphere.frag:12-21 es una cáscara de color constante, sin profundidad óptica. En el C++ actual la atmósfera nunca recibe bloom ni alimenta el halo del limbo.",
    port:
      "Reemplazar shaders/atmosphere.frag: mismo modelo, 12 muestras + LUT 2D de profundidad óptica (Bruneton) si la iGPU sufre; añadir aerial perspective a earth.frag reutilizando la densidad.",
  },
  {
    id: "aur",
    title: "Aurora volumétrica con cortinas instanciadas",
    status: "demo",
    impact: 5,
    effort: 4,
    category: "visual",
    summary:
      "Cortinas 3D animadas en el anillo OVATION real: gradiente 557.7 nm → 630 nm, flicker y ondulación por campo.",
    detail:
      "~4000 quads instanciados cruzados, cada uno plantado en su celda OVATION (probabilidad real NOAA), orientados este-oeste magnético, altura 95-250 km escalada por probabilidad. El C++ pinta el óvalo como anillo de color plano (probabilidad en el globo): el efecto 'cortina' es el diferenciador visual que el propio plan del repo deja como 'futuro físico'.",
    port:
      "Instanced rendering con glDrawElementsInstanced + atributos por instancia (iPos/iEast/iProb/iPhase); en GLFW/OpenGL 4.0 es directo. Los datos ya se descargan (AuroraAdapter).",
  },
  {
    id: "hf",
    title: "Ray-tracing HF multi-salto (secante real)",
    status: "demo",
    impact: 5,
    effort: 3,
    category: "radio",
    summary:
      "Circuitos TX→RX con arcos de reflexión reales, MUF por punto de reflexión, saltos, elevación, LUF y matriz de bandas.",
    detail:
      "La revisión detecta que 'no hay modelo de saltos': la cortina SliceLayer muestra Ne(h) pero no refracta. Aquí: geometría secante clásica (α = arccos(R·cosβ/(R+h′))), número de saltos óptimo, MUF(D) = foF2·M(D) con M(D)=1490/(hmF2+216)·(D/3000)^0.24 (Dudeney + ITU-R P.1240), LUF con absorción D dependiente del X-ray GOES (Sauer-Wilkinson simplificado), y matriz de bandas 160-10 m estilo 'modo operador'.",
    port:
      "App.cpp tiene ya slerp/grid: añadir HFTraceLayer.cpp con TubeGeometry-equivalente (ribbon camera-facing) y panel 'Circuit'. La fórmula de saltos está en src/lib/iono/hf.ts (Web) lista para portar.",
  },
  {
    id: "rep",
    title: "Replay temporal coherente (sol sigue al dato)",
    status: "demo",
    impact: 3,
    effort: 1,
    category: "ux",
    summary:
      "En replay, el terminador solar y las capas diurnas avanzan con el epoch del dato — fix de la inconsistencia del C++.",
    detail:
      "En el C++ el replayEpoch gobierna GIRO/grids/volumen, pero SolarPosition se alimenta del wall-clock: al rebobinar 3 h se ven 'datos nocturnos' con terminador diurno. Aquí el sol se calcula del tiempo efectivo. Además el GIRO getbest trae 6 h de historia por estación (72 muestras @ 5 min) para el scrubbing.",
    port:
      "App.cpp:1070-1141 — pasar replayEpoch a SolarPosition::getDirection() y a applyDayNight (una línea cada uno).",
  },
  {
    id: "sdo",
    title: "Disco solar SDO real + regiones activas geoposicionadas",
    status: "demo",
    impact: 3,
    effort: 2,
    category: "datos",
    summary:
      "Imagen HMIIF/AIA-304 en vivo con las regiones activas (sunspot_report) marcadas en sus coordenadas heliográficas.",
    detail:
      "El C++ dibuja un disco didáctico con manchas por rotación de Carrington. La mejora: proxy de latest_512_HMIIF.jpg y latest_512_0304.jpg + overlay de regiones con proyección ortográfica de lat/lon heliográfica. Clic alterna fotosfera/cromosfera.",
    port:
      "XrayAdapter o adapter nuevo SdoImageAdapter: curl + stb_image (ya en libs/). El HUD de imgui puede mostrar la textura.",
  },
  {
    id: "grd",
    title: "Grid GIRO + fondo climatológico ponderado",
    status: "demo",
    impact: 4,
    effort: 2,
    category: "fisica",
    summary:
      "IDW de GIRO con peso decreciente por distancia gran-círculo, fundido suave con modelo CCIR simplificado.",
    detail:
      "Problema del C++: la mediana global de fondo llena océanos con valores 'de otra longitud' (el F2 nocturno de océanos hereda valores diurnos). La mezcla por cercanía w = smoothstep(55°,25°,dist) hace transición física entre medición y clima. Corrige además la distancia plana → haversine (error grande en latitudes altas).",
    port:
      "interpLayerProfiles (App.cpp:474-542): sustituir d plana por haversine y añadir el término del modelo; ~40 líneas.",
  },
  {
    id: "abs",
    title: "Absorción D (Sauer-Wilkinson) integrada en LUF",
    status: "demo",
    impact: 4,
    effort: 2,
    category: "radio",
    summary:
      "A(dB) ∝ F^0.75 con X-ray GOES vivo + componente auroral por Kp — alerta de fadeout en el panel de radio.",
    detail:
      "El LUF del C++ (RadioPropagationAdapter.cpp:78-96) usa una heurística plana sin flare. Aquí el flujo X-ray real de GOES alimenta la absorción (los SID realzan la capa D) y modula LUF; se avisa cuando >1 dB en el circuito.",
    port:
      "Reemplazar absorb en lufEstimate con el término X-ray del flujo que ya llega por XrayAdapter.",
  },
  {
    id: "pipe",
    title: "Pipeline lineal: MSAA 4× en HDR + bloom + ACES",
    status: "demo",
    impact: 4,
    effort: 2,
    category: "visual",
    summary:
      "Target HalfFloat con 4× MSAA, UnrealBloom con soft threshold, tone mapping ACES y exposure fija 1.12.",
    detail:
      "La revisión encuentra: FBO sin MSAA (aliasing en cáscaras), bloom con intensity duplicado en H+V (bloom.frag:22 → intensity²), threshold duro sin soft-knee y ACES sin gestión sRGB. El pipeline web corrige los cuatro defectos.",
    port:
      "Framebuffer.h: samples=4 en el RT de la escena; bloom.frag: u_intensity solo en la pasada vertical; composite: encode sRGB final.",
  },
  {
    id: "giro",
    title: "GIRO por getbest GET (cortés) con historia",
    status: "demo",
    impact: 3,
    effort: 1,
    category: "datos",
    summary:
      "51 estaciones con 6 h de historia por petición GET única en lugar de 129 POSTs masivos cada 5 min.",
    detail:
      "El pool del C++ (16 hilos, POST scaled.php) no lleva backoff y arriesga baneo (GiroAdapter.cpp:254-277). El endpoint fastchar/getbest devuelve la serie completa por estación en una llamada; con caché 10 min y concurrencia 6 + pausa de 250 ms el servidor lo agradece.",
    port:
      "GiroAdapter: GET a /fastchar/getbest con fromDate=ahora-6h — el parseo es idéntico (líneas de columnas fijas) y la historia viene incluida.",
  },
  {
    id: "city",
    title: "Estrellas con Vía Láctea realista",
    status: "demo",
    impact: 2,
    effort: 1,
    category: "visual",
    summary: "6300 estrellas con banda galáctica gaussiana, colores por temperatura y gigantes rojas.",
    detail:
      "El starfield del C++ son 1600 puntos aleatorios sin catálogo. Aquí: distribución física de la banda + twinkling suave. Siguiente paso natural: catálogo Hipparcos embebido (~9k estrellas, 200 KB) con picos de difracción en las <2 mag.",
    port:
      "Stars.cpp: añadir la banda (cross de vectores del plano galáctico) — 15 líneas; Hipparcos como textura de atributos.",
  },

  // ─── propuestas promocionadas a demo/parcial en el drop 350 (auditoría src) ───
  {
    id: "god",
    title: "God rays / rayos crepusculares del sol real",
    status: "demo",
    impact: 4,
    effort: 3,
    category: "visual",
    summary: "Radial blur screen-space desde la posición proyectada del sol, enmascarado por el depth de la Tierra.",
    detail:
      "Implementado en el explorador web: pase post-ACES con 12 taps radiales y puerta CPU (lib/iono/godrays.ts + shader GOD en shaders.ts, ensamblado en IonosphereScene.tsx; capa togglable 'God rays' en LayersPanel.tsx). Espejo fiel del pase C++ (drops 143/147).",
    port: "Ya portado: src/Utils/Godrays.h + GodraysPass en el C++ (drops 143/147).",
  },
  {
    id: "vol",
    title: "Volumen: blue-noise jitter + empty-space skipping",
    status: "parcial",
    impact: 4,
    effort: 4,
    category: "visual",
    summary: "Elimina el banding del raymarch y acelera 2-3× saltando celdas vacías.",
    detail:
      "Jitter IGN (Jimenez 2014) del punto de entrada implementado y cableado en el march web (lib/iono/volumeJitter.ts, entryOffset en volumeMarch.ts:133); early-outs de alfa 0.98/0.001 activos. El empty-space skipping con mip de máximos del R8 no existe ni aquí ni en el C++.",
    port:
      "Pasar una textura blue-noise 64×64 + mip de máximos del R8; el bucle ya tiene early-exit.",
    missing: "empty-space skipping (mip de máximos por celda); jitter y early-outs ya aplicados",
  },
  {
    id: "shadow",
    title: "Sombra de la Tierra sobre el volumen ionosférico",
    status: "demo",
    impact: 5,
    effort: 2,
    category: "visual",
    summary: "Test rayo-esfera por muestra (2-3 ops): la sombra del planeta se arrastra por la F-region en replay.",
    detail:
      "Implementado: shadowed() (lib/iono/volumeShadow.ts) evalúa rayo-esfera por muestra y se aplica en el march (volumeMarch.ts:144 extingue la emisión); tests certificados en volumeShadow.test.ts. Visualiza el crepúsculo ionosférico real (la F-region tarda ~1 h en decaer tras el atardecer).",
    port: "Ya portado: src/Utils/VolumeShadow.h (drop 133) dentro del raymarch C++.",
  },
  {
    id: "glow",
    title: "Airglow cromático en el shell (557.7/630 nm)",
    status: "demo",
    impact: 3,
    effort: 2,
    category: "visual",
    summary: "Gradiente verde→rojo por hmF2 en el limbo nocturno, con single-scattering ficticio modulado por densidad.",
    detail:
      "Drop 354 (tuning TUNE1): IONO_FRAG mezcla bandas suaves por vHm — verde OI 557.7 nm con smoothstep(215,290) km ×0.25 (máx comparable al toque del 353) y rojo OI 630 nm con smoothstep(265,330) km ×0.85 (cálido dominante en hmF2 alto) — moduladas por un single-scattering ficticio ss = fres × (1−dayAmount) × (0.35+0.65·f) (f = foF2 0..1) · shim. Solo en hemisferio nocturno/crepúsculo; día, colormap y opacidad intactos, sin clipping additive.",
    port:
      "IonosondeLayer/GridLayer shader: mezclar término airglow según vH (altura) en el hemisferio nocturno.",
  },
  {
    id: "iono",
    title: "Ionogramas sintetizados desde el perfil Ne(h)",
    status: "aplazada",
    impact: 5,
    effort: 4,
    category: "radio",
    summary: "Traza virtual h′(f) con modos O/X y Es para la estación pineada; comparativo GIRO real vs modelo.",
    detail:
      "Con la física Epstein/Chapman ya implementada, sintetizar la traza es directo (grupo-retardo por integración 1/(d(n)/dh)). El panel comparativo (SAO real vs sintetizado) sería un validador físico del volumen — docencia pura.",
    port: "App.cpp: panel ImGui nuevo junto al StationPanel; la integral del retardo de grupo en DensityVolume.h.",
  },
  {
    id: "faraday",
    title: "Faraday con dipolo IGRF real",
    status: "propuesta",
    impact: 3,
    effort: 3,
    category: "fisica",
    summary: "Ω = 2.36e-2/f² ∫ B·cosθ·Ne dl con inclinación real del campo y por frecuencia del enlace.",
    detail:
      "La aproximación didáctica actual (Ω ≈ 2.2·TEC·(0.4+0.6|cosλ|) @100 MHz) ignora el dipolo y la dependencia 1/f². Un IGRF de grado 8 son ~80 coeficientes y 20 líneas de evaluación.",
    port: "FaradayLayer.cpp + RadioPropagationAdapter.cpp:134-140 con los coeficientes IGRF-14 embebidos.",
  },
  {
    id: "es",
    title: "Es (esporádica E) como capa de primer orden",
    status: "aplazada",
    impact: 4,
    effort: 3,
    category: "radio",
    summary: "Mapa global foEs interpolado + alertas de apertura 50 MHz + ruteo por Es en el ray-trace.",
    detail:
      "Hoy foEs solo vive en tooltips. Como foEs≥5 MHz abre 6 m/50 MHz, un mapa con alertas y la opción de rutear el enlace por E (h′ 105 km) tiene valor operacional real para radioaficionados.",
    port: "getbest soporta charName=foEs — mismo pipeline que foF2; capa GridLayer adicional a 110 km.",
  },
  {
    id: "alert",
    title: "Alertas de propagación configurables",
    status: "demo",
    impact: 4,
    effort: 2,
    category: "ux",
    summary: "Umbrales rojos configurables (Kp/Bz/X-ray/MUF), persistidos, con aviso toast y chime opcional.",
    detail:
      "Motor + panel + configuración en vivo (drop 353): AlertEngine acepta AlertThresholds rojos (kpRed/bzRed/xrayRedRank/mufRedDrop, normalizados defensivamente) y setThresholds conserva la historia MUF; las preferencias (umbrales + toast + sonido) persisten en localStorage (ionosphere.alerts.prefs.v1) vía useAlerts; el panel ALERTAS despliega sliders/select/checkboxes con Probar/Restablecer y avisa solo en transiciones ascendentes a AMBER/RED (sin spam). Espejo del motor C++ (drop 139) con capa web de configuración propia.",
    port: "Ya portado: src/Data/Alerts.h (drop 139); los umbrales configurables son extensión web (drop 353).",
  },
  {
    id: "pred",
    title: "Predicción foF2/MUF 24-48 h",
    status: "aplazada",
    impact: 5,
    effort: 4,
    category: "radio",
    summary: "Ajuste de armónicos diurnos sobre la historia GIRO + outlook F10.7 → time-travel a futuro.",
    detail:
      "El replay del C++ solo mira al pasado. Con la serie de 24 h por estación (history) se ajusta foF2(t) = a0 + a1·cos(ωt)+a2·sin(ωt)+a3·cos(2ωt)+a4·sin(2ωt) modulado por el F10.7 previsto (3-day forecast), y el pipeline de replay se reutiliza íntegro para +24 h.",
    port: "sampleHistoryAt ya interpola; añadir fit por estación en el worker y frames futuros al tecHist.",
  },
  {
    id: "export",
    title: "Exportación de datos y video del replay",
    status: "demo",
    impact: 3,
    effort: 2,
    category: "ux",
    summary: "CSV del grid foF2 con timestamp + PNG y clip de vídeo 15 s del canvas (turntable/cine).",
    detail:
      "Implementado (drop 355): PNG y CSV del último grid foF2 con la tecla E (espejo del Exporter C++: nombres UTC, %.9g, lib/iono/export.ts con tests) + botón 'Clip 15s' en la cabecera: graba 15 s del canvas 3D con MediaRecorder/captureStream y descarga el clip. Formato VP8/VP9/WebM o MP4 según soporte (VP8 preferido a 4K; bitrate adaptativo 4–25 Mbps; hasta 30 fps según rendimiento). Limitaciones: solo el canvas 3D (sin HUD), sin audio, y la pestaña debe permanecer visible durante la grabación.",
    port: "Pase de captura al terminar el composite + dump de GridData en el Timeline.",
  },
  {
    id: "tour",
    title: "Tour didáctico + localización ES/EN",
    status: "demo",
    impact: 4,
    effort: 2,
    category: "ux",
    summary: "Secuencia guiada: terminador → anomalía ecuatorial → aurora → tormenta, con textos por paso.",
    detail:
      "Implementado: cola de keyframes (lib/iono/tour.ts, 4 tramos/44 s con textos ES/EN) + overlay HTML con progreso, cambio ES/EN y cierre (page.tsx; entrada por botón 'Tour guiado' o tecla T). La cámara la mueve IonosphereScene siguiendo la cola.",
    port: "Ya portado: src/Utils/Tour.h (drop 137) con la cola de keyframes.",
  },
];

/** Hallazgos de la revisión C++: SNAPSHOT histórico (REVIEW_SNAPSHOT),
 *  no el estado actual del explorador web. */
export const FINDINGS = [
  {
    title: "Bugs de alto valor detectados",
    items: [
      "resize roto: FBOs/cámara no se redimensionan (App.cpp:561)",
      "data race GIRO: getSamples() sin lock vs pool de hilos (GiroAdapter.h:77)",
      "threads detached → use-after-free en shutdown (App.cpp:800-838)",
      "bloom intensity² por duplicar u_intensity en H y V (bloom.frag:22)",
      "CMake copia data/ inexistente → POST_BUILD falla en checkout limpio",
      "NoaaAdapter/DataManager/UI stubs: código muerto que confunde",
    ],
  },
  {
    title: "Fortalezas a conservar",
    items: [
      "Física del perfil: Epstein-Bilitza con análisis correcto del mínimo, topside difusivo",
      "Convención esférica documentada y verificada por 3 vías (spec)",
      "Worker + bundles inmutables: red y GL separados impecablemente",
      "Replay con blendGrids + sampleHistoryAt (lerp respetando huecos)",
      "Fallbacks honestos con flags 'simulated' visibles en UI",
    ],
  },
];

/** Fuentes de datos: estado verificado en REVIEW_SNAPSHOT (histórico del
 *  sandbox de la revisión), no una comprobación en vivo de hoy. */
export const DATA_SOURCES_STATUS = [
  { name: "NOAA Kp 1-min", ok: true, note: "planetary_k_index_1m.json · verificado en vivo" },
  { name: "NOAA OVATION aurora", ok: true, note: "924 KB por refresco, reducido a ~2 k celdas" },
  { name: "NOAA F10.7", ok: true, note: "f107_cm_flux.json + serie histórica" },
  { name: "NOAA viento solar (DSCOVR)", ok: true, note: "summary solar-wind-speed/mag-field (Bt, Bz en vivo)" },
  { name: "GOES X-ray", ok: true, note: "xrays-6-hour.json · clase A/B/C/M/X en vivo" },
  { name: "NOAA manchas solares", ok: true, note: "sunspot_report.json con lat/lon heliográficas" },
  { name: "NOAA forecast 3 días", ok: true, note: "3-day-forecast.txt (Kp máx + rationale)" },
  { name: "GIRO DIDBase", ok: true, note: "129 estaciones; getbest GET con historia 6 h" },
  { name: "SDO imágenes", ok: true, note: "HMIIF + AIA 304/193 (512 px, ~15 min)" },
  { name: "NOAA GloTEC (TEC)", ok: false, note: "índice desactualizado ~1 mes y frames HTTP 202 — usar como secundario" },
  { name: "D-RAP (absorción D)", ok: false, note: "JSON público retirado/404 — se calcula con modelo Sauer-Wilkinson + X-ray" },
  { name: "alerts.json / noaa-scales.json", ok: false, note: "404 intermitente en el snapshot — escalas se derivan de Kp localmente" },
];
