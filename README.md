# ionosphere-web

Visualización 3D en vivo de la ionosfera terrestre en el navegador: modelo
interactivo de la Tierra (Three.js/WebGL) con atmósfera, ionosfera, auroras,
magnetosfera, satélites y paneles de clima espacial, alimentado por **datos
reales de fuentes públicas** (NOAA, NASA, Kyoto WDC, CelesTrak, ...).

## Capturas

Vista general (1600×900, build local de producción, 2026-10-26):

![Vista general de Ionosphere Live 3D](docs/screenshots/01-overview.jpg)

| Magnetosfera y viento solar | Estrellas desactivadas |
| --- | --- |
| ![Magnetosfera y viento solar](docs/screenshots/02-magnetosfera-viento-solar.jpg) | ![Escena con el campo estelar desactivado](docs/screenshots/04-estrellas-off.jpg) |

Panel de capas, con el nuevo interruptor `Estrellas` y las ayudas de cada capa:

![Panel de capas con el interruptor Estrellas](docs/screenshots/03-panel-capas.jpg)

> En la captura con `Estrellas` desactivado, los puntos que quedan sobre el globo son satélites de ECO 2026, no estrellas.

## Fuentes de datos

Todas son públicas y no requieren API key:

- `services.swpc.noaa.gov` — NOAA SWPC: aurora (OVATION), clima espacial, D-RAP (imagen de validación)
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

## Satélites y degradación honesta

`/api/satellites` usa esta cadena por origen:

1. **CelesTrak (live)** — catálogo activo completo.
2. **Snapshot local `2026-10-17`** — captura congelada de CelesTrak (15.927 objetos), etiquetada siempre como `snapshot ... (no live)`.
3. **SatNOGS (live)** — respaldo vivo, pero solo incluye ~1.7k objetos con transmisor registrado.
4. **`unavailable`** — estado nulo; nunca se inventan datos.

El snapshot se prefiere sobre SatNOGS para conservar la densidad visual de ECO 2026. La respuesta incluye `source`, `sourceLabel`, `attribution` y `count`; `unavailable` no se cachea.

## Stack

- **Next.js 16** (App Router, `output: standalone`) + **React 19**
- **Three.js** — escena WebGL (Tierra, auroras, magnetosfera, satélites)
- **Tailwind CSS 4** + **Radix UI / shadcn** (solo quedan `toast.tsx`/`toaster.tsx`
  en `src/components/ui`; el resto del scaffolding UI shadcn se retiró en el
  drop-352 por no tener consumidores)
- **Zustand**, **TanStack Query/Table** y otras dependencias de la plantilla
  (`framer-motion`, `next-intl`, `date-fns`, `sharp`, `uuid`, `zod`, `react-markdown`,
  `@dnd-kit/*`, `@reactuses/core`) — retiradas en el drop-351: ninguna tenía
  importaciones activas en `src/`
- **Vitest 5** (tests), **ESLint 9** (flat config en `eslint.config.mjs`), **TypeScript 5**
- Probado con **Node 24 / npm 11**

## Interfaz y preferencias

- El panel **CAPAS** concentra los interruptores de la escena: nubes, estrellas, aurora, enlace HF, magnetosfera, CME, WSPR, satélites, etc. Cada control tiene `title` y `aria-label` explicativos, además de `aria-pressed`.
- **`Estrellas`** oculta o muestra el campo estelar sin reconstruir la escena; el cambio se aplica en el siguiente frame.
- **`Modo cine`** activa la rotación automática de la cámara.
- Las partículas del **viento solar** se colorean según velocidad, `Bz` y densidad, con un halo aditivo.
- Los ajustes visuales se guardan en `localStorage` bajo la clave `ionosphere.scene-settings.v1` y se restauran al recargar. Se validan y se limitan al rango de cada control; un valor inválido cae al valor por defecto.
- Se persisten toggles, sliders y modos (incluidos `cinema`, `replaySpeed` y `replayLoop`), pero **no** el estado transitorio del replay (`timeMode`, `replayMinutes`, `replayPlaying`): al recargar se vuelve a `LIVE` para no arrancar en un histórico oculto.
- Si `localStorage` está bloqueado o lleno, la aplicación sigue funcionando sin persistencia.

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
npm test        # vitest run; si existe .next, bórralo ANTES (puede romper la resolución)
npm run lint    # eslint .
```

Para otro puerto/host: `$env:PORT='3025'; npm run start` (PowerShell) o
`PORT=3025 npm run start` (bash). `scripts/start.mjs` fija `NODE_ENV=production`
y los defaults `3011`/`127.0.0.1`.

El standalone puede tardar ~5-7 s en aceptar conexiones tras imprimir "Ready";
un `curl` inmediato puede devolver 000/ECONNREFUSED. Los probes y la CI deben
reintentar durante unos segundos antes de declarar fallo.

## Entorno y secretos

- **No se necesitan API keys**: todas las fuentes son públicas.
- `.env` no está versionado (`.gitignore` cubre `.env` y `.env.*`) y no hacen
  falta ficheros `.env`: la aplicación solo lee `NODE_ENV`; en runtime el
  servidor standalone toma `PORT`/`HOSTNAME` solo del entorno (no carga `.env`).

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

| Gate | Comando | Estado local (2026-10-26, sobre drop-356) |
| --- | --- | --- |
| ESLint | `npm run lint` | 0 errores, 0 warnings |
| TypeScript | `npx tsc --noEmit` | 0 |
| Tests | `npm test` | 461/461 (48 ficheros) |
| Build | `npm run build` | 0 |
| npm audit | `npm audit --omit=dev` | 1 crítica pendiente (Next 16.3.8) |

Nota: las gates borran `.next` antes de `npm test`; el script `test` no lo hace. La vulnerabilidad de `npm audit` es de la versión de Next fijada en `package.json` y no se modificó en este cambio de UI/documentación.

## Flujo de desarrollo (drops)

- Implementación por agentes (MIMO/BEAM) → veredicto de revisión (GLM) →
  aplicación al repo canónico por MUSE → smoke test.
- **Solo MUSE** hace commit/tag/push. Force-push prohibido. Repositorio privado.

## Licencia

GPL-3.0 — ver [LICENSE](LICENSE).
