export const SOLAR_WIND_STOPS: { t: number; c: [number, number, number] }[] = [
  { t: 0.0, c: [0.45, 0.22, 0.95] },
  { t: 0.32, c: [0.95, 0.25, 0.8] },
  { t: 0.55, c: [1.0, 0.48, 0.16] },
  { t: 0.78, c: [1.0, 0.78, 0.28] },
  { t: 1.0, c: [1.0, 0.95, 0.78] },
];

export function solarWindColor(
  speed: number,
  bz: number,
  density: number,
  seed: number,
): [number, number, number] {
  const speedN = Math.max(0, Math.min(1, (speed - 250) / 650));
  const southN = Math.max(0, Math.min(1, -bz / 15));
  const t = Math.max(0, Math.min(1, 0.28 + 0.55 * speedN - 0.16 * southN + 0.13 * seed));
  let i = 0;
  while (i < SOLAR_WIND_STOPS.length - 2 && t > SOLAR_WIND_STOPS[i + 1].t) i++;
  const a = SOLAR_WIND_STOPS[i];
  const b = SOLAR_WIND_STOPS[i + 1];
  const f = (t - a.t) / (b.t - a.t + 1e-6);
  const bright = 0.86 + 0.14 * Math.max(0, Math.min(1, density / 20));
  return [
    (a.c[0] + f * (b.c[0] - a.c[0])) * bright,
    (a.c[1] + f * (b.c[1] - a.c[1])) * bright,
    (a.c[2] + f * (b.c[2] - a.c[2])) * bright,
  ];
}
