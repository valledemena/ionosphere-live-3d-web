/**
 * Colormaps científicos — port exacto de src/Utils/Colormap.h
 */

export interface Stop {
  pos: number;
  r: number;
  g: number;
  b: number;
}

const VIRIDIS: Stop[] = [
  { pos: 0.0, r: 0.267, g: 0.004, b: 0.329 },
  { pos: 0.13, r: 0.282, g: 0.14, b: 0.458 },
  { pos: 0.25, r: 0.253, g: 0.265, b: 0.53 },
  { pos: 0.38, r: 0.191, g: 0.407, b: 0.557 },
  { pos: 0.5, r: 0.127, g: 0.566, b: 0.551 },
  { pos: 0.63, r: 0.206, g: 0.718, b: 0.473 },
  { pos: 0.75, r: 0.478, g: 0.824, b: 0.318 },
  { pos: 0.88, r: 0.741, g: 0.873, b: 0.15 },
  { pos: 1.0, r: 0.993, g: 0.906, b: 0.144 },
];

const INFERNO: Stop[] = [
  { pos: 0.0, r: 0.0, g: 0.0, b: 0.04 },
  { pos: 0.13, r: 0.108, g: 0.031, b: 0.31 },
  { pos: 0.25, r: 0.358, g: 0.045, b: 0.451 },
  { pos: 0.38, r: 0.595, g: 0.083, b: 0.405 },
  { pos: 0.5, r: 0.786, g: 0.153, b: 0.203 },
  { pos: 0.63, r: 0.932, g: 0.318, b: 0.131 },
  { pos: 0.75, r: 0.984, g: 0.5, b: 0.147 },
  { pos: 0.88, r: 0.988, g: 0.711, b: 0.3 },
  { pos: 1.0, r: 0.988, g: 0.998, b: 0.645 },
];

const PLASMA: Stop[] = [
  { pos: 0.0, r: 0.05, g: 0.03, b: 0.527 },
  { pos: 0.13, r: 0.24, g: 0.017, b: 0.678 },
  { pos: 0.25, r: 0.471, g: 0.028, b: 0.696 },
  { pos: 0.38, r: 0.681, g: 0.107, b: 0.594 },
  { pos: 0.5, r: 0.838, g: 0.264, b: 0.443 },
  { pos: 0.63, r: 0.944, g: 0.446, b: 0.32 },
  { pos: 0.75, r: 0.986, g: 0.654, b: 0.258 },
  { pos: 0.88, r: 0.989, g: 0.852, b: 0.354 },
  { pos: 1.0, r: 0.94, g: 0.975, b: 0.131 },
];

const TURBO: Stop[] = [
  { pos: 0.0, r: 0.19, g: 0.071, b: 0.232 },
  { pos: 0.13, r: 0.214, g: 0.357, b: 0.77 },
  { pos: 0.25, r: 0.165, g: 0.604, b: 0.843 },
  { pos: 0.38, r: 0.196, g: 0.784, b: 0.582 },
  { pos: 0.5, r: 0.45, g: 0.866, b: 0.314 },
  { pos: 0.63, r: 0.762, g: 0.784, b: 0.042 },
  { pos: 0.75, r: 0.954, g: 0.555, b: 0.036 },
  { pos: 0.88, r: 0.966, g: 0.256, b: 0.052 },
  { pos: 1.0, r: 0.648, g: 0.033, b: 0.112 },
];

const AURORA: Stop[] = [
  { pos: 0.0, r: 0.0, g: 0.01, b: 0.0 },
  { pos: 0.25, r: 0.0, g: 0.25, b: 0.05 },
  { pos: 0.5, r: 0.05, g: 0.65, b: 0.15 },
  { pos: 0.75, r: 0.3, g: 1.0, b: 0.35 },
  { pos: 1.0, r: 0.85, g: 1.0, b: 0.55 },
];

export type ColormapName = "viridis" | "inferno" | "plasma" | "turbo" | "aurora";

const TABLES: Record<ColormapName, Stop[]> = {
  viridis: VIRIDIS,
  inferno: INFERNO,
  plasma: PLASMA,
  turbo: TURBO,
  aurora: AURORA,
};

export function sampleColormap(name: ColormapName, t: number): [number, number, number] {
  const stops = TABLES[name] ?? VIRIDIS;
  const tt = Math.max(0, Math.min(1, t));
  let s = 0;
  for (let j = 0; j < stops.length - 1; j++) {
    if (tt >= stops[j].pos && tt <= stops[j + 1].pos) {
      s = j;
      break;
    }
  }
  const a = stops[s];
  const b = stops[s + 1] ?? stops[stops.length - 1];
  const f = (tt - a.pos) / (b.pos - a.pos + 1e-6);
  return [a.r + f * (b.r - a.r), a.g + f * (b.g - a.g), a.b + f * (b.b - a.b)];
}

/**
 * Paleta completa (W-3, spec 162-P1): port de colormap::buildPalette
 * (src/Utils/Colormap.h). Misma semantica: t = i/(n-1), busqueda de tramo
 * por inclusion, interpolacion lineal con guarda 1e-6, nombre desconocido
 * -> viridis. Opera sobre las mismas tablas de este fichero (alineacion
 * declarada: un solo juego de stops; sampleColormap y buildPalette son
 * dos vistas del mismo dato). Salida plana RGB x n.
 */
export function buildPalette(name: string, n: number): number[] {
  const stops =
    name === "inferno"
      ? INFERNO
      : name === "plasma"
      ? PLASMA
      : name === "turbo"
      ? TURBO
      : name === "aurora"
      ? AURORA
      : VIRIDIS;
  const out = new Array<number>(n * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    let s = 0;
    for (let j = 0; j < stops.length - 1; j++) {
      if (t >= stops[j].pos && t <= stops[j + 1].pos) {
        s = j;
        break;
      }
    }
    const f = (t - stops[s].pos) / (stops[s + 1].pos - stops[s].pos + 1e-6);
    out[i * 3 + 0] = stops[s].r + f * (stops[s + 1].r - stops[s].r);
    out[i * 3 + 1] = stops[s].g + f * (stops[s + 1].g - stops[s].g);
    out[i * 3 + 2] = stops[s].b + f * (stops[s + 1].b - stops[s].b);
  }
  return out;
}

/** Rampa CSS para leyendas UI */
export function colormapCss(name: ColormapName, n = 64): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const [r, g, b] = sampleColormap(name, t);
    pts.push(
      `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)}) ${(
        t * 100
      ).toFixed(1)}%`
    );
  }
  return `linear-gradient(90deg, ${pts.join(", ")})`;
}
