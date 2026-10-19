"use client";

/** Catálogo de ideas exploradas con evaluación de adecuación.
 *  Contenido derivado de la revisión de código en profundidad del repositorio
 *  ionosphere-live-3d (C++/OpenGL) y de la verificación de fuentes de datos.
 */

export interface IdeaItem {
  id: string;
  title: string;
  status: "demo" | "propuesta" | "aplazada"; // aplazada = fuera de paridad (poda 136), sin ciclo propio
  impact: number; // 1-5
  effort: number; // 1-5
  category: "visual" | "fisica" | "datos" | "radio" | "ux";
  summary: string;
  detail: string;
  port?: string; // cómo portarlo al C++
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

  // ─── propuestas no implementadas en el demo ───
  {
    id: "god",
    title: "God rays / rayos crepusculares del sol real",
    status: "propuesta",
    impact: 4,
    effort: 3,
    category: "visual",
    summary: "Radial blur screen-space desde la posición proyectada del sol, enmascarado por el depth de la Tierra.",
    detail:
      "La geometría ideal ya existe (sol exacto de SolarPosition + oclusora). Efecto 'cine' más barato con más impacto en escenas de terminador. El plan visual del repo (Fase 4) ya lo contempla para lens flare.",
    port: "Pase extra tras el composite: 12 taps radiales con máscara del depth buffer ya existente.",
  },
  {
    id: "vol",
    title: "Volumen: blue-noise jitter + empty-space skipping",
    status: "propuesta",
    impact: 4,
    effort: 4,
    category: "visual",
    summary: "Elimina el banding del raymarch y acelera 2-3× saltando celdas vacías.",
    detail:
      "VolumeRenderer.cpp:66 usa paso fijo sin jitter (banding visible en el limbo) y recorre celdas vacías. Un offset R2/blue-noise por píxel+frame + un mip de máximos permite 256 pasos solo donde hay densidad.",
    port: "Pasar una textura blue-noise 64×64 + mip de máximos del R8; el bucle ya tiene early-exit.",
  },
  {
    id: "shadow",
    title: "Sombra de la Tierra sobre el volumen ionosférico",
    status: "propuesta",
    impact: 5,
    effort: 2,
    category: "visual",
    summary: "Test rayo-esfera por muestra (2-3 ops): la sombra del planeta se arrastra por la F-region en replay.",
    detail:
      "Barato y espectacular: en el raymarch, si el segmento muestra→sol cruza la esfera interior, extinguir emisión. Visualiza el crepúsculo ionosférico real (la F-region tarda ~1 h en decaer tras el atardecer).",
    port: "VolumeRenderer.cpp: dentro del loop de acumulación, igual que el lightOD de la atmósfera web.",
  },
  {
    id: "glow",
    title: "Airglow cromático en el shell (557.7/630 nm)",
    status: "aplazada",
    impact: 3,
    effort: 2,
    category: "visual",
    summary: "Gradiente verde-rojo por altura en el limbo nocturno del shell, estilo fotográfico ISS.",
    detail:
      "En vez de color=colormap puro, añadir término de single-scattering ficticio hacia el sol modulado por densidad — el mapa de datos se vuelve 'fotográfico' sin tocar evalNeTotal (respeta la regla del plan del repo).",
    port: "IonosondeLayer/GridLayer shader: mezclar término airglow según vH (altura) en el hemisferio nocturno.",
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
    status: "propuesta",
    impact: 4,
    effort: 2,
    category: "ux",
    summary: "Umbrales Kp≥5, Bz<−10, X-ray≥M, caída MUF>20% vs mediana 24 h → toast + registro + sonido.",
    detail:
      "Los datos ya llegan (NoaaAdapter/SolarWind). Un pequeño motor de reglas + cola de eventos en el worker publicaría bundles 'alert' que la UI consume. En web: mismo patrón con Server-Sent Events o polling.",
    port: "fetchWorker() ya centraliza los datos: evaluar reglas al publicar cada bundle.",
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
    status: "propuesta",
    impact: 3,
    effort: 2,
    category: "ux",
    summary: "CSV de cualquier variable del grid con timestamp + turntable PNG/video del cine-mode.",
    detail:
      "Útil para docencia e informes. El FBO está a un glReadPixels de un PNG; el CSV son los grids que ya viven en memoria.",
    port: "Pase de captura al terminar el composite + dump de GridData en el Timeline.",
  },
  {
    id: "tour",
    title: "Tour didáctico + localización ES/EN",
    status: "propuesta",
    impact: 4,
    effort: 2,
    category: "ux",
    summary: "Secuencia guiada: terminador → anomalía ecuatorial → aurora → tormenta, con textos por paso.",
    detail:
      "Los tooltips son excelentes pero solo en inglés y no hay narrativa. Un 'tour' con keyframes de cámara + overlays de texto convierte la herramienta en material docente autocontenido.",
    port: "App.cpp: cola de (camRY, camDist, texto, condición) avanzada por timer; i18n con tabla de strings.",
  },
];

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
  { name: "alerts.json / noaa-scales.json", ok: false, note: "404 intermitente hoy — escalas se derivan de Kp localmente" },
];
