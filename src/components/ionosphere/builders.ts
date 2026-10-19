/**
 * Constructores de objetos de escena Three.js.
 * Cada builder devuelve el objeto listo para añadir a scene + referencias
 * a materiales/geometry para actualización posterior.
 */

import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { latLonToVec3 } from "@/lib/iono/geo";
import { buildPalette, ColormapName } from "@/lib/iono/colormaps";
import { DECAY, FALLOFF_K, GAIN, MAX_RADIUS, SUN_B, SUN_G, SUN_R } from "@/lib/iono/godrays";
import {
  EARTH_VERT, EARTH_FRAG,
  ATMO_VERT, ATMO_FRAG,
  IONO_VERT, IONO_FRAG,
  AURORA_VERT, AURORA_FRAG,
  STAR_VERT, STAR_FRAG,
  STATION_VERT, STATION_FRAG,
  RAY_VERT, RAY_FRAG,
  GODRAYS_VERT, GODRAYS_FRAG,
  VOL_VERT, VOL_FRAG,
} from "./shaders";
import type { DensityVolume } from "@/lib/iono/densityVolume";
import { AuroraCell, IonosondeStation } from "./types";

export const GRID_W = 72;
export const GRID_H = 36;

// ───────────────────────── estrellas ─────────────────────────
export function buildStars(pixelRatio: number) {
  const N_UNIFORM = 3400;
  const N_BAND = 2900;
  const N = N_UNIFORM + N_BAND + 60; // +60 brillantes
  const pos = new Float32Array(N * 3);
  const mag = new Float32Array(N);
  const col = new Float32Array(N * 3);

  const galacticNormal = new THREE.Vector3(0.48, 0.82, 0.31).normalize();

  let i = 0;
  const put = (v: THREE.Vector3, m: number, c: [number, number, number]) => {
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    mag[i] = m;
    col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    i++;
  };
  const starColor = (): [number, number, number] => {
    const r = Math.random();
    if (r < 0.12) return [1.0, 0.72, 0.52]; // gigantes rojas
    if (r < 0.3) return [1.0, 0.9, 0.75]; // cálidas
    if (r < 0.72) return [1.0, 0.98, 0.95]; // blancas
    if (r < 0.92) return [0.78, 0.86, 1.0]; // azul-blanco
    return [0.62, 0.74, 1.0]; // azules
  };
  const randDir = () => {
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return new THREE.Vector3(s * Math.cos(phi), u, s * Math.sin(phi));
  };

  for (let k = 0; k < N_UNIFORM; k++) {
    put(randDir().multiplyScalar(40), 2.2 + Math.pow(Math.random(), 2.2) * 3.6, starColor());
  }
  // banda galáctica: círculo máximo + dispersión gaussiana
  const t1 = new THREE.Vector3(1, 0, 0).cross(galacticNormal).normalize();
  const t2 = galacticNormal.clone().cross(t1).normalize();
  for (let k = 0; k < N_BAND; k++) {
    const th = Math.random() * Math.PI * 2;
    const g = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; // ~gauss
    const v = t1.clone().multiplyScalar(Math.cos(th)).add(t2.clone().multiplyScalar(Math.sin(th)));
    v.add(galacticNormal.clone().multiplyScalar(g * 0.16)).normalize();
    put(v.multiplyScalar(40), 2.6 + Math.pow(Math.random(), 2.0) * 3.4, starColor());
  }
  // brillantes con halo
  for (let k = 0; k < 60; k++) {
    put(randDir().multiplyScalar(39.5), Math.random() * 1.4, starColor());
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aMag", new THREE.BufferAttribute(mag, 1));
  geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));

  const mat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: pixelRatio },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  return { points, mat };
}

// ───────────────────────── tierra ─────────────────────────
export function buildEarth(dayTex: THREE.Texture, nightTex: THREE.Texture) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: EARTH_VERT,
    fragmentShader: EARTH_FRAG,
    uniforms: {
      uDayTex: { value: dayTex },
      uNightTex: { value: nightTex },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uCameraPos: { value: new THREE.Vector3(0, 0, 3) },
      uNight: { value: 0.45 },
      uTime: { value: 0 },
      uCloudAmt: { value: 0.55 },
      uAtmoTint: { value: 1.0 },
      uFlare: { value: 0 }, // W-4 #3: flash X-ray (lo gobierna la escena)
    },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), mat);
  return { mesh, mat };
}

// ───────────────────────── atmósfera ─────────────────────────
export function buildAtmosphere() {
  const mat = new THREE.ShaderMaterial({
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uCameraPos: { value: new THREE.Vector3(0, 0, 3) },
      uIntensity: { value: 1.0 },
      uSteps: { value: 12.0 },
      uLightSteps: { value: 4.0 },
    },
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.0255, 64, 48), mat);
  return { mesh, mat };
}

// ───────────────────────── colormap LUT ─────────────────────────
// W-3 primer wiring visual (P1-170): la LUT se construye con buildPalette
// (via certificada del oraculo Colormap.h) en vez de muestreo por punto;
// ambas vistas son el mismo dato (bit-identica 0/256 en 5/5 paletas,
// veredicto 172: el render no cambia ni 1 LSB).
export function buildColormapTexture(name: ColormapName): THREE.DataTexture {
  const pal = buildPalette(name, 256);
  const data = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    data[i * 4] = Math.round(pal[i * 3] * 255);
    data[i * 4 + 1] = Math.round(pal[i * 3 + 1] * 255);
    data[i * 4 + 2] = Math.round(pal[i * 3 + 2] * 255);
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, 256, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ───────────────────────── shell ionosférica ─────────────────────────
export function buildIonShell(cmapTex: THREE.Texture) {
  // texturas de datos (rellenas luego)
  const foData = new Float32Array(GRID_W * GRID_H);
  const hmData = new Float32Array(GRID_W * GRID_H);
  const foTex = new THREE.DataTexture(
    new Uint16Array(GRID_W * GRID_H), GRID_W, GRID_H, THREE.RedFormat, THREE.HalfFloatType
  );
  const hmTex = new THREE.DataTexture(
    new Uint16Array(GRID_W * GRID_H), GRID_W, GRID_H, THREE.RedFormat, THREE.HalfFloatType
  );
  for (const t of [foTex, hmTex]) {
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.wrapS = THREE.RepeatWrapping;
    t.needsUpdate = true;
  }
  void foData; void hmData;

  const mat = new THREE.ShaderMaterial({
    vertexShader: IONO_VERT,
    fragmentShader: IONO_FRAG,
    uniforms: {
      uFoF2: { value: foTex },
      uHmF2: { value: hmTex },
      uCmap: { value: cmapTex },
      uSunDir: { value: new THREE.Vector3(1, 0, 0) },
      uCameraPos: { value: new THREE.Vector3(0, 0, 3) },
      uOpacity: { value: 0.85 },
      uMinF: { value: 2 },
      uMaxF: { value: 10 },
      uTime: { value: 0 },
      uDayBoost: { value: 1 },
      uExaggeration: { value: 2.2 },
      uKp: { value: 2 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 72), mat);
  mesh.scale.setScalar(1.001); // ligeramente sobre la superficie base (desplazado por hmF2 en el shader)
  return { mesh, mat, foTex, hmTex };
}

/** Rellena las DataTexture del shell con los grids (valores por celdas fila 0 = norte) */
export function updateShellTextures(
  foTex: THREE.DataTexture,
  hmTex: THREE.DataTexture,
  foGrid: Float32Array, // GRID_W*GRID_H, fila 0 = lat +90
  hmGrid: Float32Array,
  fMin: number,
  fMax: number
) {
  const foArr = foTex.image.data as Uint16Array;
  const hmArr = hmTex.image.data as Uint16Array;
  const fToHalf = (v: number) => {
    const h = THREE.DataUtils.toHalfFloat(Math.min(1, Math.max(0, v)));
    return h;
  };
  for (let i = 0; i < GRID_W * GRID_H; i++) {
    foArr[i] = fToHalf((foGrid[i] - fMin) / (fMax - fMin || 1));
    hmArr[i] = fToHalf(hmGrid[i] / 400);
  }
  foTex.needsUpdate = true;
  hmTex.needsUpdate = true;
}

// ───────────────────────── aurora ─────────────────────────
export function buildAurora(cells: AuroraCell[]) {
  // base quad
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.attributes.position = base.attributes.position;
  geo.attributes.uv = base.attributes.uv;

  const inst = cells.length * 2; // quads cruzados
  const iPos = new Float32Array(inst * 3);
  const iEast = new Float32Array(inst * 3);
  const iUp = new Float32Array(inst * 3);
  const iProb = new Float32Array(inst);
  const iPhase = new Float32Array(inst);
  const iRot = new Float32Array(inst);

  let k = 0;
  for (const c of cells) {
    const [x, y, z] = latLonToVec3(c.lat, c.lon, 1.0);
    const up = new THREE.Vector3(x, y, z).normalize();
    const phi = ((c.lon + 180) * Math.PI) / 180;
    const east = new THREE.Vector3(Math.sin(phi), 0, Math.cos(phi)).normalize();
    const prob = c.p / 100;
    const phase = Math.random() * Math.PI * 2;
    for (let r = 0; r < 2; r++) {
      iPos[k * 3] = x; iPos[k * 3 + 1] = y; iPos[k * 3 + 2] = z;
      iEast[k * 3] = east.x; iEast[k * 3 + 1] = east.y; iEast[k * 3 + 2] = east.z;
      iUp[k * 3] = up.x; iUp[k * 3 + 1] = up.y; iUp[k * 3 + 2] = up.z;
      iProb[k] = prob;
      iPhase[k] = phase;
      iRot[k] = r === 0 ? 0 : Math.PI / 2;
      k++;
    }
  }
  geo.setAttribute("iPos", new THREE.InstancedBufferAttribute(iPos, 3));
  geo.setAttribute("iEast", new THREE.InstancedBufferAttribute(iEast, 3));
  geo.setAttribute("iUp", new THREE.InstancedBufferAttribute(iUp, 3));
  geo.setAttribute("iProb", new THREE.InstancedBufferAttribute(iProb, 1));
  geo.setAttribute("iPhase", new THREE.InstancedBufferAttribute(iPhase, 1));
  geo.setAttribute("iRot", new THREE.InstancedBufferAttribute(iRot, 1));
  geo.instanceCount = k;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.6);

  const mat = new THREE.ShaderMaterial({
    vertexShader: AURORA_VERT,
    fragmentShader: AURORA_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uHeightScale: { value: 2.0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, mat };
}

// ───────────────────────── estaciones ─────────────────────────
export function buildStations(stations: IonosondeStation[], cmapTex: THREE.Texture, fMin: number, fMax: number) {
  const n = stations.length;
  const pos = new Float32Array(n * 3);
  const aFo = new Float32Array(n);
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const s = stations[i];
    const [x, y, z] = latLonToVec3(s.lat, s.lon, 1.012);
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    const f = s.foF2;
    aFo[i] = f && f > 0 ? Math.min(1, Math.max(0, (f - fMin) / (fMax - fMin || 1))) : 0;
    codes.push(s.code);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aFo", new THREE.BufferAttribute(aFo, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.2);

  const mat = new THREE.ShaderMaterial({
    vertexShader: STATION_VERT,
    fragmentShader: STATION_FRAG,
    uniforms: {
      uCmap: { value: cmapTex },
      uMinF: { value: fMin },
      uMaxF: { value: fMax },
      uPixelRatio: { value: Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2) },
      uTime: { value: 0 },
      uHighlight: { value: 0 },
      uHasData: { value: 1 },
      // W-4 E-tail o6: tamaño crudo 3..30 (el shader normaliza /11).
      uPointSize: { value: 11 },
    },
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return { points, mat, codes, positions: pos };
}

// ───────────────────────── rayos HF ─────────────────────────
export function buildLinkTube(
  points3D: { lat: number; lon: number; altKm: number; hopIndex: number; viable: number }[],
  exaggeration: number
) {
  const curve = new THREE.CatmullRomCurve3(
    points3D.map((p) => {
      const [x, y, z] = latLonToVec3(p.lat, p.lon, 1 + (p.altKm / 6371) * exaggeration);
      return new THREE.Vector3(x, y, z);
    }),
    false,
    "catmullrom",
    0.2
  );
  const TUBE_SEG = Math.min(360, Math.max(120, points3D.length * 2));
  const tube = new THREE.TubeGeometry(curve, TUBE_SEG, 0.0075, 6, false);
  // atributos por vértice: aViable + aArc
  const n = tube.attributes.position.count;
  const aViable = new Float32Array(n);
  const aArc = new Float32Array(n);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(tube.attributes.position, i);
    // u = parámetro de arco del tubo (i ordenado por segmento)
    const seg = Math.floor(i / 7); // radialSegments+1 = 7
    const u = Math.min(1, Math.max(0, seg / TUBE_SEG));
    aArc[i] = u;
    // nearest original point para viability
    const idx = Math.round(u * (points3D.length - 1));
    aViable[i] = points3D[Math.min(idx, points3D.length - 1)].viable;
  }
  tube.setAttribute("aViable", new THREE.BufferAttribute(aViable, 1));
  tube.setAttribute("aArc", new THREE.BufferAttribute(aArc, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: RAY_VERT,
    fragmentShader: RAY_FRAG,
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(tube, mat);
  return { mesh, mat };
}

// ───────────────────────── cascaras de referencia E/F1/F2 ─────────────────────────
// W-4 F1: esferas wireframe (ecuador + paralelos 0,±30,±60 N=72 +
// 6 meridianos N=48, GL_LINES) con colores y altitudes del oraculo
// (RefShells.h/.cpp: E110 verde, F1 dinámica amarilla, F2 dinámica
// naranja; sin anillo D). Alturas y exageración por parámetros;
// el rebuild por clave vive en la escena (como el slice).
export function buildRefShells(
  alts: { e: number; f1: number; f2: number },
  exaggeration: number,
) {
  const group = new THREE.Group();
  const shells = [
    { altKm: alts.e, color: new THREE.Color(0.1, 0.45, 0.2) },
    { altKm: alts.f1, color: new THREE.Color(0.5, 0.42, 0.1) },
    { altKm: alts.f2, color: new THREE.Color(0.5, 0.22, 0.07) },
  ];
  for (const d of shells) {
    const r = 1 + (d.altKm / 6371) * exaggeration;
    const mat = new THREE.LineBasicMaterial({
      color: d.color,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const addLine = (pts: THREE.Vector3[]) => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      group.add(new THREE.Line(geo, mat));
    };
    for (const lat of [0, 30, -30, 60, -60]) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 72; i++) {
        const [x, y, z] = latLonToVec3(lat, (i / 72) * 360 - 180, r);
        pts.push(new THREE.Vector3(x, y, z));
      }
      addLine(pts);
    }
    for (let m = 0; m < 6; m++) {
      const lon = m * 60 - 180;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 48; i++) {
        const [x, y, z] = latLonToVec3(-90 + (i / 48) * 180, lon, r);
        pts.push(new THREE.Vector3(x, y, z));
      }
      addLine(pts);
    }
  }
  return { group };
}

// ───────────────────────── glow del sol ─────────────────────────
export function buildSunGlow() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,245,1)");
  grad.addColorStop(0.18, "rgba(255,250,220,0.9)");
  grad.addColorStop(0.4, "rgba(255,230,170,0.28)");
  grad.addColorStop(1, "rgba(255,220,150,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const core = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      color: 0xfff8e8,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  core.scale.setScalar(0.55);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex,
      color: 0xffe9c0,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      opacity: 0.45,
    })
  );
  halo.scale.setScalar(1.7);
  return { core, halo };
}

// ------------------------- volumen Ne (raymarch) -------------------------
// W-3 P2-182: malla proxy + texturas 3D R8 (densidad LINEAR, capa NEAREST)
// como init()/updateVolume() del oraculo. El material lleva los defaults
// (viridis, densidad, 64 pasos, opacidad 1, iso off).
export function buildVolumeMesh(cmapTex: THREE.Texture) {
  const geo = new THREE.SphereGeometry(1, 64, 32);
  const densityTex = new THREE.Data3DTexture(new Uint8Array(4), 1, 1, 1);
  densityTex.format = THREE.RedFormat;
  densityTex.minFilter = THREE.LinearFilter;
  densityTex.magFilter = THREE.LinearFilter;
  densityTex.wrapS = THREE.ClampToEdgeWrapping;
  densityTex.wrapT = THREE.ClampToEdgeWrapping;
  densityTex.wrapR = THREE.ClampToEdgeWrapping;
  densityTex.needsUpdate = true;
  const layerTex = new THREE.Data3DTexture(new Uint8Array(4), 1, 1, 1);
  layerTex.format = THREE.RedFormat;
  layerTex.minFilter = THREE.NearestFilter;
  layerTex.magFilter = THREE.NearestFilter;
  layerTex.wrapS = THREE.ClampToEdgeWrapping;
  layerTex.wrapT = THREE.ClampToEdgeWrapping;
  layerTex.wrapR = THREE.ClampToEdgeWrapping;
  layerTex.needsUpdate = true;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      u_density: { value: densityTex },
      u_layer: { value: layerTex },
      u_colormap: { value: cmapTex },
      u_camPos: { value: new THREE.Vector3() },
      u_sunDir: { value: new THREE.Vector3(0, 0, 1) },
      u_innerR: { value: 1.0 },
      u_outerR: { value: 1.1 },
      u_opacityScale: { value: 1.0 },
      u_steps: { value: 64 },
      u_colorMode: { value: 0 },
      u_volRes: { value: new THREE.Vector3() },
      u_isoOn: { value: 0 },
      u_isoWidth: { value: 0.02 },
    },
    vertexShader: VOL_VERT,
    fragmentShader: VOL_FRAG,
    // SIN glslVersion: three emite #version 300 es con defines de compat
    // (gl_FragColor/varying/texture2D) en WebGL2 -- con THREE.GLSL3 el shader
    // no compilaria (n1-184: gl_FragColor no definido + vec3-int).
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  return { mesh, mat, densityTex, layerTex };
}

/** Sube el volumen vivo (R8 como updateVolume(); recrea si cambian dims). */
export function updateVolumeTextures(
  prev: { densityTex: THREE.Data3DTexture; layerTex: THREE.Data3DTexture } | null,
  vol: DensityVolume
): { densityTex: THREE.Data3DTexture; layerTex: THREE.Data3DTexture } {
  const W = vol.lonRes;
  const H = vol.latRes;
  const A = vol.altRes;
  let densityTex: THREE.Data3DTexture;
  let layerTex: THREE.Data3DTexture;
  if (
    prev &&
    (prev.densityTex.image as { width: number; height: number; depth: number }).width === W &&
    (prev.densityTex.image as { width: number; height: number; depth: number }).height === H &&
    (prev.densityTex.image as { width: number; height: number; depth: number }).depth === A
  ) {
    densityTex = prev.densityTex;
    layerTex = prev.layerTex;
  } else {
    if (prev) {
      prev.densityTex.dispose();
      prev.layerTex.dispose();
    }
    densityTex = new THREE.Data3DTexture(new Uint8Array(W * H * A), W, H, A);
    densityTex.format = THREE.RedFormat;
    densityTex.minFilter = THREE.LinearFilter;
    densityTex.magFilter = THREE.LinearFilter;
    densityTex.wrapS = THREE.ClampToEdgeWrapping;
    densityTex.wrapT = THREE.ClampToEdgeWrapping;
    densityTex.wrapR = THREE.ClampToEdgeWrapping;
    layerTex = new THREE.Data3DTexture(new Uint8Array(W * H * A), W, H, A);
    layerTex.format = THREE.RedFormat;
    layerTex.minFilter = THREE.NearestFilter;
    layerTex.magFilter = THREE.NearestFilter;
    layerTex.wrapS = THREE.ClampToEdgeWrapping;
    layerTex.wrapT = THREE.ClampToEdgeWrapping;
    layerTex.wrapR = THREE.ClampToEdgeWrapping;
  }
  const dd = densityTex.image.data as Uint8Array;
  for (let i = 0; i < vol.data.length; i++) {
    // P3-184: truncado como el (unsigned char) del oraculo (no round).
    const v = vol.data[i];
    dd[i] = Math.max(0, Math.min(255, Math.trunc((v < 0 ? 0 : v > 1 ? 1 : v) * 255)));
  }
  densityTex.needsUpdate = true;
  if (vol.layer.length === vol.data.length) {
    const ld = layerTex.image.data as Uint8Array;
    for (let i = 0; i < vol.layer.length; i++) ld[i] = vol.layer[i];
    layerTex.needsUpdate = true;
  }
  return { densityTex, layerTex };
}

// ------------------------- god rays (post-ACES) -------------------------
// W-3 P1-177: pase pantalla con las constantes nombradas del espejo
// (DECAY/MAX_RADIUS/FALLOFF_K/GAIN/sol calido de godrays.ts). Corre el
// ultimo (tras OutputPass): GAIN post-ACES por construccion. La puerta CPU
// (projectSun + gateSkip) la evalua la escena por frame con el mirror.
export function buildGodRaysPass() {
  const pass = new ShaderPass(
    {
      uniforms: {
        tDiffuse: { value: null },
        u_sunUV: { value: new THREE.Vector2(0.5, 0.5) },
        u_sunColor: { value: new THREE.Color(SUN_R, SUN_G, SUN_B) },
        u_gain: { value: GAIN },
        u_decay: { value: DECAY },
        u_radius: { value: MAX_RADIUS },
        u_falloffK: { value: FALLOFF_K },
        u_aspect: { value: 16 / 9 },
        u_invViewProj: { value: new THREE.Matrix4() },
        u_camPos: { value: new THREE.Vector3() },
      },
      vertexShader: GODRAYS_VERT,
      fragmentShader: GODRAYS_FRAG,
    },
    "tDiffuse"
  );
  return pass;
}
