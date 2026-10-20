# ionosphere-web

Visualización 3D en vivo de la ionosfera terrestre en el navegador: modelo
interactivo de la Tierra (Three.js/WebGL) con atmósfera, ionosfera, auroras,
magnetosfera, satélites y paneles de clima espacial, alimentado por **datos
reales de fuentes públicas** (NOAA, NASA, Kyoto WDC, CelesTrak, ...).

## Fuentes de datos

Todas son públicas y no requieren API key:

- `services.swpc.noaa.gov` — NOAA SWPC: aurora (OVATION), clima espacial
- `www.swpc.noaa.gov` — NOAA SWPC: D-RAP (absorción de la región D)
- `api.weather.gov` — NOAA/NWS: alertas meteorológicas activas
- `ccmc.gsfc.nasa.gov` — NASA CCMC DONKI: CME, flare (FLR), RBE, GST
- `celestrak.org` — TLE NORAD (grupo active)
- `db.satnogs.org` — TLE SatNOGS
- `lgdc.uml.edu` — ionosondes DIDBase (foF2)
- `noaa-goes18/19.s3.amazonaws.com` — flashes GLM de los GOES
- `prop.kc2g.com` — ionosondes KC2G
- `sdo.gsfc.nasa.gov` — imágenes solares SDO (HMI/AIA)
- `soho.nascom.nasa.gov` — coronágrafo LASCO C2 (SOHO)
- `ssd.jpl.nasa.gov` — JPL Horizons (Voyager)
- `wdc.kugi.kyoto-u.ac.jp` — Kyoto WDC: Dst y AE
- `wsprnet.org` — spots WSPR

## Stack

- **Next.js 16** (App Router, `output: standalone`) + **React 19**
- **Three.js** — escena WebGL (Tierra, auroras, magnetosfera, satélites)
- **Tailwind CSS 4** + **Radix UI / shadcn** (estilo `new-york`, componentes en `src/components/ui`)
- **Recharts** — gráficos de los paneles
- **Zustand**, **TanStack Query/Table** — declarados en `package.json` (hoy sin importaciones activas en `src/`)
- **Vitest 5** (tests), **ESLint 9** (flat config en `eslint.config.mjs`), **TypeScript 5**
- Probado con **Node 24 / npm 11**

## Rutas API

15 rutas (`src/app/api/**/route.ts`):

- 14 de datos: `/api/ae`, `/api/aurora`, `/api/cme`, `/api/dst`, `/api/flares`,
  `/api/ionosondes`, `/api/lightning`, `/api/msis`, `/api/rbe`, `/api/satellites`,
  `/api/solar-image`, `/api/space-weather`, `/api/voyager`, `/api/wspr`
- `/api` (raíz): health-check `{"message":"Hello, world!"}`

## Desarrollo (Windows)

Los scripts de `package.json` son portables (Node puro, sin utilidades POSIX):

```powershell
# Dev (puerto 3000)
npm run dev

# Build (producción: next build + copia a .next/standalone)
npm run build

# Servir el build standalone (defaults PORT=3011, HOSTNAME=127.0.0.1;
# PORT/HOSTNAME del entorno tienen prioridad)
npm run start

# Tests / lint
npm test        # vitest run (borra .next antes si existe un build)
npm run lint    # eslint .
```

## Entorno y secretos

- **No se necesitan API keys**: todas las fuentes son públicas.
- `.env` no está versionado (`.gitignore` cubre `.env` y `.env.*`, preservando
  un futuro `.env.example`). La aplicación solo lee `NODE_ENV`; el servidor
  standalone además acepta `PORT`/`HOSTNAME`.

## Assets (texturas)

| Fichero | Dimensiones | Calidad | Uso |
| --- | --- | --- | --- |
| `public/textures/earth-day.jpg` | 5400×2700 | q88 | textura diurna |
| `public/textures/earth-night-hires.jpg` | 8192×4096 | q86, progresivo 4:4:4 | noche en alta resolución |
| `public/textures/earth-night.jpg` | 2048×1024 | q84 | fallback para GPUs modestas |

El loader usa la hires solo si `renderer.capabilities.maxTextureSize >= 8192`
(constante `NIGHT_HIRES_MIN_MAX_TEXTURE` en `IonosphereScene.tsx`); en caso
contrario carga el fallback.

## Gates del proyecto

| Gate | Comando | Estado (drop-345) |
| --- | --- | --- |
| ESLint | `npm run lint` | 0 errores, 0 warnings |
| TypeScript | `npx tsc --noEmit` | 0 |
| Tests | `npm test` | 399/399 (43 ficheros) |
| Build | `npm run build` | 0 |
| npm audit | `npm audit --omit=dev` | 0 vulnerabilidades |

## Flujo de desarrollo (drops)

- Implementación por agentes (MIMO/BEAM) → veredicto de revisión (GLM) →
  aplicación al repo canónico por MUSE → smoke test.
- **Solo MUSE** hace commit/tag/push. Force-push prohibido. Repositorio privado.

## Licencia

GPL-3.0 — ver [LICENSE](LICENSE).
