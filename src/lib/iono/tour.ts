/**
 * Tour didactico W-2 (spec del veredicto 152, P4): cola de keyframes pura.
 * Port del modulo C++ (drop 137, src/Utils/Tour.h): mismos 4 tramos, mismas
 * duraciones (12+12+10+10 = 44 s), misma curva smoothstep, textos 137
 * reutilizados verbatim, reloj que solo avanza con dato listo. Puro: sin
 * DOM ni three. La camara la mueve IonosphereScene (adaptacion Q2: el
 * ry absoluto rota el azimut orbital y dist fija el radio; el polar se
 * conserva, como en el C++ donde el tour solo toca rotateY+distance).
 */
export interface TourKey {
  ry: number; // rotacion Y de camara al final del tramo (rad)
  dist: number; // distancia de camara al final del tramo
  dur: number; // duracion del tramo (s)
  es: string;
  en: string;
}

// Cola: 4 tramos (W0 inicial implicito 0.0/3.2). Total 44 s.
const KEYS: TourKey[] = [
  // 1. Terminador (W0 0.0/3.2 -> 0.6/3.2, 12 s).
  {
    ry: 0.6,
    dist: 3.2,
    dur: 12.0,
    es: "Terminador: la linea dia-noche. La ionosfera despierta con el Sol: la densidad crece en el lado diurno y decae de noche.",
    en: "Terminator: the day-night line. The ionosphere wakes with the Sun: density grows on the dayside and decays at night.",
  },
  // 2. Anomalia ecuatorial (0.6/3.2 -> 1.4/2.6, 12 s).
  {
    ry: 1.4,
    dist: 2.6,
    dur: 12.0,
    es: "Anomalia ecuatorial: dos crestas de densidad a +-15 grados del ecuador magnetico, con el valle encima del ecuador.",
    en: "Equatorial anomaly: two density crests at +-15 degrees of the magnetic equator, with the trough above the equator.",
  },
  // 3. Aurora (1.4/2.6 -> 2.4/3.0, 10 s).
  {
    ry: 2.4,
    dist: 3.0,
    dur: 10.0,
    es: "Aurora: el ovalo auroral se aviva con la actividad geomagnetica (Kp alto, Bz sur).",
    en: "Aurora: the auroral oval brightens with geomagnetic activity (high Kp, southward Bz).",
  },
  // 4. Tormenta (2.4/3.0 -> 3.4/2.8, 10 s).
  {
    ry: 3.4,
    dist: 2.8,
    dur: 10.0,
    es: "Tormenta: viento solar rapido y Bz sur perturban la propagacion HF (MUF inestable, bandas cerradas).",
    en: "Storm: fast solar wind and southward Bz disturb HF propagation (unstable MUF, closed bands).",
  },
];

export function tourCount(): number {
  return KEYS.length;
}

export function tourKey(i: number): TourKey {
  return KEYS[Math.min(Math.max(i, 0), KEYS.length - 1)];
}

export function tourTotal(): number {
  return KEYS.reduce((a, k) => a + k.dur, 0);
}

export interface TourState {
  ry: number;
  dist: number;
  index: number; // tramo activo 0..3
  done: boolean;
}

// Curva t -> estado (suavizado smoothstep dentro del tramo).
export function tourEval(t: number): TourState {
  if (t <= 0) return { ry: 0.0, dist: 3.2, index: 0, done: false };
  let acc = 0;
  let prevRy = 0.0;
  let prevDist = 3.2;
  for (let i = 0; i < KEYS.length; i++) {
    const k = KEYS[i];
    if (t < acc + k.dur) {
      let u = (t - acc) / k.dur;
      u = u * u * (3.0 - 2.0 * u);
      return { ry: prevRy + (k.ry - prevRy) * u, dist: prevDist + (k.dist - prevDist) * u, index: i, done: false };
    }
    acc += k.dur;
    prevRy = k.ry;
    prevDist = k.dist;
  }
  return { ry: 3.4, dist: 2.8, index: KEYS.length - 1, done: true };
}

// Avance del reloj: solo suma dt si hay dato listo (condicion verificable).
export function tourAdvance(clock: number, dt: number, ready: boolean): number {
  return ready ? clock + dt : clock;
}
