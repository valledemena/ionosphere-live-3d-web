/**
 * Shaders GLSL para Ionosphere Live 3D — Web Explorer.
 *
 * Convencion esferica: lon 0 -> +X, lon 90E -> -Z, +Y norte.
 * UV equirectangular del shell: u = phi/(2pi) (phi = atan(z, -x)) tras el
 * fix 175 (antes +0.5: drape a lon+180, cancelado con datos espejados).
 */

// ─────────────────────────── TIERRA ───────────────────────────
export const EARTH_VERT = /* glsl */ `
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vFragPos;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vFragPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const EARTH_FRAG = /* glsl */ `
uniform sampler2D uDayTex;
uniform sampler2D uNightTex;
uniform vec3 uSunDir;      // dirección AL sol (mundo)
uniform vec3 uCameraPos;
uniform float uNight;       // brillo luces nocturnas 0..1
uniform float uTime;        // segundos
uniform float uCloudAmt;    // 0..1
uniform float uAtmoTint;    // 0..1 perspectiva aérea simple
uniform float uFlare;       // W-4 #3: flash X-ray 0..1 (solo díaside)
varying vec3 vNormal;
varying vec2 vUv;
varying vec3 vFragPos;

// Ruido de valor 3D (port del C++, sin costuras)
float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), u.x),
                 mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), u.x),
                 mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), u.x), u.y), u.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + vec3(1.7); a *= 0.5; }
  return v;
}

void main() {
  // La malla es una esfera en el origen, escala 1: normal mundo = normalize(vFragPos)
  vec3 n = normalize(vFragPos);
  vec3 sun = normalize(uSunDir);
  vec3 viewDir = normalize(uCameraPos - vFragPos);
  float ndl = dot(n, sun);

  float dayAmount = smoothstep(-0.08, 0.25, ndl);
  float band = smoothstep(-0.08, 0.02, ndl) * (1.0 - smoothstep(0.02, 0.35, ndl));

  vec3 texColor = texture2D(uDayTex, vUv).rgb;

  vec3 dayCol = texColor * (0.12 + 1.05 * dayAmount);
  dayCol += vec3(0.38, 0.13, 0.03) * band * (0.35 + 0.65 * dayAmount);

  // Océano por dominancia azul -> sun glitter Blinn-Phong
  float ocean = smoothstep(0.008, 0.07, texColor.b - max(texColor.r, texColor.g));
  vec3 hv = normalize(sun + viewDir);
  float spec = pow(max(dot(n, hv), 0.0), 36.0) * ocean * dayAmount;
  dayCol += vec3(1.0, 0.95, 0.85) * spec * 0.7;

  vec3 nightTex = texture2D(uNightTex, vUv).rgb;
  vec3 nightCol = nightTex * (uNight * 2.5) + vec3(0.004, 0.007, 0.016);

  vec3 col = mix(nightCol, dayCol, dayAmount);

  // Nubes procedurales fbm con deriva (port del C++)
  if (uCloudAmt > 0.001) {
    float ca = cos(uTime * 0.005), sa = sin(uTime * 0.005);
    vec3 rp = vec3(ca * n.x - sa * n.z, n.y, sa * n.x + ca * n.z);
    float f = fbm(rp * 3.0);
    float t0 = 1.05 - uCloudAmt * 0.6 + 0.03 * sin(uTime * 0.02 + n.y * 3.0);
    float cov = smoothstep(t0 - 0.18, t0 + 0.22, f) * uCloudAmt;
    vec3 cloudLit = vec3(1.02, 1.0, 0.98) * (0.04 + 1.05 * dayAmount);
    cloudLit += vec3(0.45, 0.15, 0.03) * band * 0.8;
    // sombra suave de nube al suelo (muestreo desplazado hacia el sol)
    float fsh = fbm(rp * 3.0 + sun * 0.06);
    float shadow = smoothstep(t0 - 0.1, t0 + 0.1, fsh);
    col *= 1.0 - 0.22 * cov * shadow * dayAmount;
    col = mix(col, cloudLit, clamp(cov, 0.0, 0.9));
  }

  // Perspectiva aérea simple: tinte azul y extinción hacia el limbo
  float rim = 1.0 - max(dot(viewDir, n), 0.0);
  float haze = pow(rim, 2.5) * uAtmoTint;
  col = mix(col, vec3(0.35, 0.55, 0.9) * (0.25 + 0.75 * dayAmount), haze * 0.45);

  // W-4 #3: flash del flare — sigue al terminador REAL via dayAmount
  // (O3.3: nada en la noche); cálido, declarado como realce, no física.
  col += vec3(1.0, 0.55, 0.2) * uFlare * dayAmount * 0.35;

  gl_FragColor = vec4(col, 1.0);
}
`;

// ─────────────────────── ATMÓSFERA (Rayleigh/Mie real) ───────────────────────
export const ATMO_VERT = /* glsl */ `
varying vec3 vFragPos;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vFragPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const ATMO_FRAG = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uCameraPos;
uniform float uIntensity;
uniform float uSteps;        // 8..16 (calidad)
uniform float uLightSteps;   // 3..6
varying vec3 vFragPos;

const float PLANET_R = 1.0;
const float ATM_R    = 1.0255;   // ~162 km
const float H_R      = 8.5e-3;   // escala Rayleigh en unidades de radio terrestre (8.5km/6371km*... ajustado)
const float H_M      = 1.2e-2;
// β escalado a unidades de planeta (β_m × R_planeta_m): Rayleigh (450,550,650nm) / Mie
const vec3  BETA_R   = vec3(5.8, 13.5, 33.1) * 0.0105;
const float BETA_M   = 21.0 * 0.0105;
const float G_MIE    = 0.76;

float raySphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return -1.0;
  return -b - sqrt(h);
}

// densidad combinada acumulada a lo largo de [a, b] hacia el sol
vec2 lightOD(vec3 p, vec3 sunDir) {
  float tExit = raySphere(p, sunDir, ATM_R);
  if (tExit <= 0.0) return vec2(0.0);
  float dt = tExit / uLightSteps;
  float odR = 0.0, odM = 0.0;
  for (int i = 0; i < 6; i++) {
    if (float(i) >= uLightSteps) break;
    vec3 q = p + sunDir * (dt * (float(i) + 0.5));
    float h = max(length(q) - PLANET_R, 0.0);
    odR += exp(-h / H_R) * dt;
    odM += exp(-h / H_M) * dt;
  }
  return vec2(odR, odM);
}

void main() {
  vec3 ro = uCameraPos;
  vec3 rd = normalize(vFragPos - uCameraPos);
  vec3 sun = normalize(uSunDir);

  // Segmento dentro de la atmósfera
  float t0 = raySphere(ro, rd, ATM_R);
  if (t0 < 0.0) discard;
  float t1 = raySphere(ro, rd, PLANET_R); // entrada al planeta (si hit) o salida atm
  if (t1 < 0.0) t1 = distance(ro, vFragPos); // fragmento en cara trasera: límite

  // Si la cámara está fuera, t0 = entrada. Si dentro, t0 debería ser 0.
  if (dot(ro, ro) > ATM_R * ATM_R && t0 > 0.0) { /* ok */ } else { t0 = max(t0, 0.0); }
  float segLen = t1 - t0;
  if (segLen <= 0.0) discard;

  int N = int(uSteps);
  float dt = segLen / uSteps;
  float mu = dot(rd, sun);
  float phaseR = 3.0 / (16.0 * 3.14159265) * (1.0 + mu * mu);
  float g = G_MIE;
  float phaseM = 3.0 / (8.0 * 3.14159265) * ((1.0 - g * g) * (1.0 + mu * mu)) /
                ((2.0 + g * g) * pow(1.0 + g * g - 2.0 * g * mu, 1.5));

  vec3 sumR = vec3(0.0);
  vec3 sumM = vec3(0.0);
  float odR = 0.0, odM = 0.0;

  for (int i = 0; i < 16; i++) {
    if (i >= N) break;
    vec3 p = ro + rd * (t0 + dt * (float(i) + 0.5));
    float h = max(length(p) - PLANET_R, 0.0);
    float dR = exp(-h / H_R) * dt;
    float dM = exp(-h / H_M) * dt;
    odR += dR; odM += dM;

    // sombra del planeta: el rayo al sol desde p no debe cruzar la Tierra
    float tPlanet = raySphere(p, sun, PLANET_R);
    if (tPlanet > 0.0) continue;

    vec2 lod = lightOD(p, sun);
    vec3 tau = BETA_R * (odR + lod.x) + BETA_M * 1.1 * (odM + lod.y);
    vec3 att = exp(-tau);
    sumR += dR * att;
    sumM += dM * att;
  }

  vec3 col = (sumR * BETA_R * phaseR + sumM * BETA_M * phaseM) * uIntensity * 20.0;

  // Sundisk leve integrado en el limbo (más rojo al atardecer ya por extinción)
  gl_FragColor = vec4(col, 1.0);
}
`;

// ─────────────────────── SHELL IONOSFÉRICA (foF2) ───────────────────────
export const IONO_VERT = /* glsl */ `
uniform sampler2D uHmF2;      // grid hmF2 (72×36) — altura de la capa
uniform float uExaggeration; // 1..5
uniform float uKp;           // respiración por tormenta
uniform float uTime;
varying vec3 vFragPos;
varying vec3 vNormalW;
varying vec2 vGridUv;        // uv del grid (para foF2)
varying float vHm;
void main() {
  vec3 dir = normalize(position);
  // phi = atan(z, -x); u = phi/(2pi) SIN +0.5 (ruling 174 n1: el +0.5
  // desplazaba cada columna a lon+180 de su lon de datos; con datos del
  // lado verdadero el drape debe ser identidad: u(col c) = lon(c)).
  // v = 0.5 + asin(y)/pi (con el flip 1-v al muestrear, como el fo).
  float phi = atan(dir.z, -dir.x);
  float uu = fract(phi / 6.28318530718);
  float vv = clamp(0.5 + asin(clamp(dir.y, -1.0, 1.0)) / 3.14159265359, 0.0, 1.0);
  vGridUv = vec2(uu, vv);
  float hm = texture2D(uHmF2, vec2(uu, 1.0 - vv)).r * 400.0; // decodificado a km
  vHm = hm;
  float alt = hm / 6371.0 * uExaggeration;
  // respiración con Kp (storm swell del C++)
  float breathe = 1.0 + 0.035 * uKp * (0.6 + 0.4 * sin(uTime * 0.7 + uu * 6.28318530718 * 2.0));
  vec3 displaced = dir * (1.0 + alt * breathe);
  vec4 wp = modelMatrix * vec4(displaced, 1.0);
  vFragPos = wp.xyz;
  vNormalW = dir;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const IONO_FRAG = /* glsl */ `
uniform sampler2D uFoF2;      // grid foF2 (72×36) normalizado
uniform sampler2D uCmap;      // 256×1 colormap
uniform vec3 uSunDir;
uniform vec3 uCameraPos;
uniform float uOpacity;
uniform float uMinF;         // rango de normalización
uniform float uMaxF;
uniform float uTime;
uniform float uDayBoost;     // refuerzo visual en el lado diurno
varying vec3 vFragPos;
varying vec3 vNormalW;
varying vec2 vGridUv;
varying float vHm;

float hash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), u.x),
                 mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), u.x), u.y),
             mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), u.x),
                 mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), u.x), u.y), u.z);
}

void main() {
  vec2 gUv = vec2(vGridUv.x, 1.0 - vGridUv.y);
  float f = texture2D(uFoF2, gUv).r;
  float fo = mix(uMinF, uMaxF, f);

  // colormap científico
  vec3 base = texture2D(uCmap, vec2(f, 0.5)).rgb;

  vec3 n = normalize(vNormalW);
  vec3 sun = normalize(uSunDir);
  vec3 viewDir = normalize(uCameraPos - vFragPos);
  float ndl = dot(n, sun);
  float dayAmount = smoothstep(-0.15, 0.2, ndl);

  // Fresnel: brillo en el limbo
  float fres = pow(1.0 - max(dot(viewDir, n), 0.0), 2.2);

  // shimmer sutil (plasma vivo)
  float shim = 0.85 + 0.15 * vnoise(n * 24.0 + vec3(0.0, 0.0, uTime * 0.05));

  float alpha = uOpacity * (0.28 + 0.72 * fres) * shim;
  alpha *= (0.45 + 0.55 * dayAmount * uDayBoost);

  vec3 col = base * (0.55 + 0.9 * dayAmount);
  // toque "airglow" en el limbo nocturno (verde tenue 557.7nm)
  col += vec3(0.05, 0.28, 0.16) * fres * (1.0 - dayAmount) * 0.35;

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

// ─────────────────────── AURORA (cortinas instanciadas) ───────────────────────
export const AURORA_VERT = /* glsl */ `
attribute vec3 iPos;     // posición base (superficie)
attribute vec3 iEast;    // dirección este local
attribute vec3 iUp;      // dirección radial local
attribute float iProb;   // probabilidad 0..1
attribute float iPhase;  // fase aleatoria
attribute float iRot;    // 0 o 90° (quads cruzados)
uniform float uTime;
uniform float uHeightScale; // 1..3
varying float vY;        // 0..1 altura relativa
varying float vProb;
varying float vPhase;
varying vec3 vWorldPos;
void main() {
  float width = 0.9 + 1.6 * iProb;        // grados-ish de ancho
  float height = (95.0 + 155.0 * iProb) / 6371.0 * uHeightScale; // 95-250 km
  vec2 corner = position.xy;               // PlaneGeometry(1,1): x∈[-.5,.5], y∈[-.5,.5]
  // rotar el quad alrededor de up
  float a = iRot;
  vec2 rc = vec2(corner.x * cos(a) - corner.y * sin(a), corner.x * sin(a) + corner.y * cos(a));
  float w = rc.x * width * 0.01745 * 2.0;  // ~2° de arco
  float y = (rc.y + 0.5);                  // 0..1
  vY = y;
  vec3 east = normalize(iEast);
  vec3 up = normalize(iUp);
  vec3 p = iPos + east * w + up * y * height;
  // ondulación de cortina
  p += up * sin(uTime * 0.35 + iPhase + corner.x * 4.0) * height * 0.035;
  vProb = iProb;
  vPhase = iPhase;
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const AURORA_FRAG = /* glsl */ `
uniform float uTime;
varying float vY;
varying float vProb;
varying float vPhase;
varying vec3 vWorldPos;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

void main() {
  // perfil vertical: núcleo verde brillante abajo-medio, rojo arriba (630nm), púrpura extremos
  float core = exp(-pow((vY - 0.42) * 4.2, 2.0));
  float redTop = smoothstep(0.55, 1.0, vY) * 0.55;
  float purpleEdge = smoothstep(0.85, 1.0, vY) * 0.35;

  // flicker viajero (rayos de cortina)
  float flick = 0.72 + 0.28 * sin(uTime * 1.3 + vPhase * 6.0 + vY * 9.0);
  flick *= 0.8 + 0.2 * hash11(floor(vPhase * 100.0) + floor(uTime * 3.0));

  vec3 col = vec3(0.05, 0.95, 0.38) * core * 1.6
           + vec3(0.95, 0.18, 0.10) * redTop
           + vec3(0.55, 0.25, 0.85) * purpleEdge;

  float alpha = (core * 0.9 + redTop * 0.5 + purpleEdge * 0.4) * vProb * flick;
  gl_FragColor = vec4(col * vProb * flick * 1.35, clamp(alpha, 0.0, 0.85));
}
`;

// ─────────────────────── ESTRELLAS ───────────────────────
export const STAR_VERT = /* glsl */ `
attribute float aMag;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelRatio;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  vAlpha = 0.35 + 0.65 * (1.0 - aMag / 6.0);
  vAlpha *= 0.88 + 0.12 * sin(uTime * 0.7 + position.x * 12.0 + position.y * 7.0);
  vColor = aColor;
  gl_PointSize = max(1.0, (3.2 - aMag) * 1.6) * uPixelRatio;
}
`;

export const STAR_FRAG = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  float a = smoothstep(1.0, 0.0, d) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}
`;

// ─────────────────────── ESTACIONES (puntos GIRO) ───────────────────────
export const STATION_VERT = /* glsl */ `
attribute float aFo;     // foF2 normalizado 0..1
uniform float uMinF;
uniform float uMaxF;
uniform float uPixelRatio;
uniform float uTime;
uniform float uHighlight; // 0/1 parpadeo para la seleccionada
uniform float uPointSize; // W-4 E-tail o6: escala (1.0 = base 140)
varying float vF;
varying float vFade;
void main() {
  vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  // Techo escala con el setting hasta 35 px (a 11 == 26 px, look actual
  // intacto; a 30 == 35 px, la mitad del exceso).
  gl_PointSize = clamp(140.0 * uPointSize / 11.0 / dist, 3.0, min(26.0 * uPointSize / 11.0, 35.0)) * uPixelRatio;
  vF = aFo;
  // pulso suave de vida
  vFade = 0.75 + 0.25 * sin(uTime * 2.2 + position.x * 40.0 + position.y * 33.0);
  if (uHighlight > 0.5) vFade = 0.6 + 0.4 * sin(uTime * 6.0);
}
`;

export const STATION_FRAG = /* glsl */ `
uniform sampler2D uCmap;
uniform float uHasData;
varying float vF;
varying float vFade;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0) discard;
  float a = smoothstep(1.0, 0.25, d) * vFade;
  vec3 col = uHasData > 0.5 ? texture2D(uCmap, vec2(vF, 0.5)).rgb : vec3(0.55);
  // halo exterior
  float halo = smoothstep(1.0, 0.55, d) - smoothstep(0.55, 0.0, d);
  gl_FragColor = vec4(col + vec3(0.9) * halo * 0.35, a * (uHasData > 0.5 ? 0.95 : 0.45));
}
`;

// ─────────────────────── RAYOS HF (tubo) ───────────────────────
export const RAY_VERT = /* glsl */ `
attribute float aViable; // 0 cerrado, 0.5 marginal, 1 abierto (por vértice)
attribute float aArc;    // posición a lo largo del tubo 0..1
uniform float uTime;
varying float vViable;
varying float vArc;
varying float vPulse;
void main() {
  vViable = aViable;
  vArc = aArc;
  vPulse = fract(uTime * 0.22 - aArc * 2.5);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const RAY_FRAG = /* glsl */ `
varying float vViable;
varying float vArc;
varying float vPulse;
void main() {
  vec3 open = vec3(0.10, 0.95, 0.55);   // verde: abierto
  vec3 marg = vec3(0.98, 0.72, 0.10);   // ámbar: marginal
  vec3 closed = vec3(0.95, 0.16, 0.16); // rojo: cerrado
  vec3 col = vViable > 0.75 ? open : (vViable > 0.25 ? marg : closed);
  // pulso viajero (energía del enlace)
  float pulse = exp(-pow((vPulse - 0.5) * 6.0, 2.0)) * 0.9;
  float base = 0.55;
  gl_FragColor = vec4(col * (base + pulse), 0.9);
}
`;

// ----------------------- GOD RAYS (post-ACES) -----------------------
// Pase pantalla de god rays (W-3 P1-177): port GLSL1 de shaders/godrays.frag
// del oraculo (12 taps radiales al sol con aspecto, pesos decay^i, mascara
// analitica opcion B, puerta CPU fuera). Corre TRAS OutputPass (post-ACES,
// display): lee el color resuelto y suma el aporte. Sin componente temporal.
export const GODRAYS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const GODRAYS_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 u_sunUV;
uniform vec3 u_sunColor;
uniform float u_gain;
uniform float u_decay;
uniform float u_radius;
uniform float u_falloffK;
uniform float u_aspect;
uniform mat4 u_invViewProj;
uniform vec3 u_camPos;
varying vec2 vUv;

bool raySphere(vec3 ro, vec3 rd, float r, out float t0, out float t1) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float disc = b * b - c;
  if (disc < 0.0) return false;
  float s = sqrt(disc);
  t0 = -b - s;
  t1 = -b + s;
  return true;
}

void main() {
  vec3 base = texture2D(tDiffuse, vUv).rgb;
  vec2 auv = vec2(vUv.x * u_aspect, vUv.y);
  vec2 asun = vec2(u_sunUV.x * u_aspect, u_sunUV.y);
  vec2 d = asun - auv;
  float L = length(d);
  float fall = 1.0 / (1.0 + u_falloffK * L);
  vec3 rays = vec3(0.0);
  if (L > 1e-5) {
    vec2 dir = d / L;
    float stepLen = min(L, u_radius) / 11.0;
    for (int i = 0; i < 12; i++) {
      vec2 auvTap = auv + dir * (stepLen * float(i));
      vec2 tapUV = vec2(auvTap.x / u_aspect, auvTap.y);
      vec4 clip = vec4(tapUV * 2.0 - 1.0, 1.0, 1.0);
      vec4 world = u_invViewProj * clip;
      vec3 tdir = normalize(world.xyz / world.w - u_camPos);
      float t0, t1;
      float mask = 1.0;
      if (raySphere(u_camPos, tdir, 1.0, t0, t1) && t1 > 1e-4) mask = 0.0;
      float w = pow(u_decay, float(i));
      rays += u_sunColor * (w * mask);
    }
  }
  gl_FragColor = vec4(base + u_gain * fall * rays, 1.0);
}
`;

// ----------------------- VOLUMEN Ne (raymarch) -----------------------
// Pase volumetrico W-3 (P2-182): port GLSL3 de volFragSrc
// (src/Ionosphere/VolumeRenderer.cpp:48-141). Esfera proxy con culled
// frontal (se entra por la cara interior); marcha con jitter IGN, sombra
// dura, decode geo motor, iso-bandas y acumulacion front-to-back.
// Requiere three GLSL3 (sampler3D + texelFetch exacto).
export const VOL_VERT = /* glsl */ `
varying vec3 vWorldPos;
void main() {
  vWorldPos = vec3(modelMatrix * vec4(position, 1.0));
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;

export const VOL_FRAG = /* glsl */ `
uniform sampler3D u_density;
uniform sampler3D u_layer;
uniform sampler2D u_colormap;
uniform vec3 u_camPos;
uniform vec3 u_sunDir;
uniform float u_innerR, u_outerR;
uniform float u_opacityScale;
uniform int u_steps;
uniform int u_colorMode;
uniform ivec3 u_volRes;
uniform int u_isoOn;
uniform float u_isoWidth;
varying vec3 vWorldPos;

bool raySphere(vec3 ro, vec3 rd, float r, out float t0, out float t1) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float disc = b * b - c;
  if (disc < 0.0) return false;
  float s = sqrt(disc);
  t0 = -b - s;
  t1 = -b + s;
  return true;
}

void main() {
  vec3 ro = u_camPos;
  vec3 rd = normalize(vWorldPos - u_camPos);

  float tOutA, tOutB;
  if (!raySphere(ro, rd, u_outerR, tOutA, tOutB)) discard;
  float tEnter = max(tOutA, 0.0);
  float tExit = tOutB;

  float tInA, tInB;
  if (raySphere(ro, rd, u_innerR, tInA, tInB) && tInA > tEnter) {
    tExit = min(tExit, tInA);
  }
  if (tExit <= tEnter) discard;

  if (u_colorMode == 1) {
    float tEA, tEB;
    if (raySphere(ro, rd, 1.0, tEA, tEB) && tEA > tEnter) {
      tExit = min(tExit, tEA);
    }
    if (tExit <= tEnter) discard;
  }

  float dt = (tExit - tEnter) / float(u_steps);
  float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float tEnterJ = tEnter + dt * jit;
  vec3 accumColor = vec3(0.0);
  float accumAlpha = 0.0;

  for (int i = 0; i < 256; i++) {
    if (i >= u_steps) break;
    float t = tEnterJ + dt * (float(i) + 0.5);
    if (t >= tExit) break;

    vec3 p = ro + rd * t;
    float sh0, sh1;
    float sunShadow = 1.0;
    if (raySphere(p, u_sunDir, u_innerR, sh0, sh1) && sh0 > 1e-4) sunShadow = 0.0;
    float r = length(p);
    float altNorm = clamp((r - u_innerR) / (u_outerR - u_innerR), 0.0, 1.0);

    vec3 n = p / max(r, 1e-6);
    float lat = asin(clamp(n.y, -1.0, 1.0));
    float lon = 3.14159265 - atan(n.z, n.x);
    if (lon > 3.14159265) lon -= 2.0 * 3.14159265;
    if (lon < -3.14159265) lon += 2.0 * 3.14159265;
    vec2 uv = vec2(lon / (2.0 * 3.14159265) + 0.5, lat / 3.14159265 + 0.5);

    float d = texture(u_density, vec3(uv, altNorm)).r;
    vec3 col;
    if (u_colorMode == 1) {
      // ID exacto por texelFetch (el LINEAR corromperia fronteras: 1.7 no
      // es ninguna capa).
      ivec3 ip = ivec3(clamp(vec3(floor(uv.x * float(u_volRes.x)),
                                           floor(uv.y * float(u_volRes.y)),
                                           floor(altNorm * float(u_volRes.z))),
                                   vec3(0.0), vec3(u_volRes) - 1.0));
      int w = int(texelFetch(u_layer, ip, 0).r * 255.0 + 0.5);
      if (w == 0)      col = vec3(1.00, 0.55, 0.10);
      else if (w == 1) col = vec3(0.20, 0.85, 0.30);
      else if (w == 2) col = vec3(1.00, 0.90, 0.20);
      else             col = vec3(0.20, 0.80, 1.00);
    } else {
      col = texture(u_colormap, vec2(d, 0.5)).rgb;
    }
    col *= sunShadow;
    float a = clamp(d * d * u_opacityScale * dt * 40.0, 0.0, 1.0) * sunShadow;
    if (u_isoOn != 0) {
      float m = min(min(abs(d - 0.556), abs(d - 0.667)), abs(d - 0.778));
      float band = 1.0 - smoothstep(0.0, u_isoWidth, m);
      col = mix(col, vec3(1.0), band * 0.55);
      a = max(a, min(band * 0.35, u_opacityScale));
    }

    accumColor += (1.0 - accumAlpha) * a * col;
    accumAlpha += (1.0 - accumAlpha) * a;
    if (accumAlpha > 0.98) break;
  }
  if (accumAlpha <= 0.001) discard;
  gl_FragColor = vec4(accumColor, accumAlpha);
}
`;
