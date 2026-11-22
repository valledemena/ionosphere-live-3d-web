# DW.3 — Pre-registro: extraer `solarWindColor` de `IonosphereScene.tsx`

> Estado: **PRE-REGISTRO** — pendiente de acta de GLM y GO de David antes
> de tocar código.
> Repo: `valledemena/ionosphere-live-3d-web`. Head exacto:
> **`118c7e9766c516d767500cc4ff27cac875580151`** (`main` tras DW.2).

## 1. Contexto y alcance

`src/components/ionosphere/IonosphereScene.tsx` tiene 1 873 líneas. El
acta `0454` §6 fija que una descomposición es una **serie** de slices
pequeños, no un big-bang. DW.3 mueve **un** bloque cohesivo: la función
pura `solarWindColor()` y su tabla `SOLAR_WIND_STOPS`.

Estado actual en `118c7e9`:

- `SOLAR_WIND_STOPS`: líneas 102–108 (5 entradas `t`/`c`).
- `solarWindColor(speed, bz, density, seed)`: líneas 110–129, función
  pura, sin dependencias de React/THREE ni de otros módulos.
- Una sola llamada interna: línea 937, dentro del mismo componente.
- No es exportada; ningún fichero del repo la importa (`git grep` sobre
  `118c7e9` confirma 4 ocurrencias, todas en `IonosphereScene.tsx`).

## 2. Cambio pre-registrado

1. **Nuevo** `src/components/ionosphere/solarWindColor.ts`: contiene
   `SOLAR_WIND_STOPS` y `solarWindColor` **trasladados literalmente**
   (mismo cuerpo, mismo orden de operations, sin refactor ni cambio de
   tipos), con `export` nominal de la función.
2. **`IonosphereScene.tsx`**: se retiran las dos definiciones y se añade
   un `import { solarWindColor } from "./solarWindColor";` junto al
   resto de imports locales. La llamada de la línea 937 queda intacta.

Superficie pública: el default export `IonosphereScene` y su `Props` no
cambian. `solarWindColor` pasa a ser un módulo exportado **nuevo**, pero
no se re-exporta desde `IonosphereScene.tsx`; los consumidores
(`page.tsx`) no se tocan. Si se decidiera re-exportar, se declararía
aquí antes de hacerlo: **no se hace en DW.3**.

Fuera de alcance:任何其他 función del componente, `builders.ts`,
`shaders.ts`, `types.ts`, `package.json`, configuración, tests y
dependencias.

## 3. Criterio binario (pre-registrado)

**PASS** solo si todo se cumple sobre el head del change:

1. `npm run build` → rc=0.
2. `npm run lint` → rc=0.
3. `npm test` → rc=0, **48 ficheros / 461 tests / 0 fallos**, sin
   cambiar ningún test ni su composición (ancla del acta `0454` §6.2).
4. `git grep -n "function solarWindColor" src/` → **exactamente 1**
   definición, en el fichero nuevo; 0 en `IonosphereScene.tsx`.
5. Diffstat con **forma de movimiento**: líneas borradas de
   `IonosphereScene.tsx` y líneas añadidas en `solarWindColor.ts` en
   magnitud comparable (≈30–40 por lado); el import añadido es una
   línea. Un desbalance grande o lógica nueva = FAIL (acta `0454` §6.3).
6. Cuerpo de `solarWindColor` **byte-idéntico** al original salvo el
   `export` y el sangrado: se verifica con diff de los dos bloques.

Cualquier desviación = FAIL, sin merge.

## 4. Instrumentos y evidencia

- Head de partida: `118c7e9`. Head del change: el resultante, con
  padre inmediato `118c7e9` (sin commits ajenos).
- Evidencia: diff completo, logs de build/lint/test, grep de definición
  única, diff comparativo del bloque movido, `git status` y head+padre.
- Bundle para GLM (decisión `0452` B y nota `0454` §6): delta
  `118c7e9..<head del change>`, con sha256 publicado en INTERCAMBIO y
  `git bundle verify`. El bundle DW.2 (`dw2-web-0961a57-f746654.bundle`,
  2 778 B, sha256 `a0e9ec88…`) sigue en
  `INTERCAMBIO/work/` a la espera de entrega manual por David.
- Gate: acta de GLM sobre el head exacto + GO de David antes del merge.
  Sin CI en el repo web: evidencia local y ferry, como en DW.1/DW.2.

## 5. Referencias

- Acta `0454` §6 (tres notas: pasos pequeños, anclajes de comportamiento,
  diffstat con forma de movimiento).
- Acta `0452` B (bundles por head, sin credenciales).
- Baseline web `f7771da`; DW.1 `0961a57`; DW.2 `118c7e9`.
