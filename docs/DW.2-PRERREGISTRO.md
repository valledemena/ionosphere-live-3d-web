# DW.2 — Pre-registro: higiene de test en la web (vitest y artefactos de build)

> Estado: **PRE-REGISTRO** — pendiente de acta de GLM y GO de David antes
> de tocar código.
> Repo: `valledemena/ionosphere-live-3d-web`. Head exacto:
> **`0961a579b12c2a0e023315738c155c634a3ae0f5`** (`main`, tras DW.1).

## 1. Contexto

El acta `0451` (conformidad de DW.1) registró dos observaciones menores
no bloqueantes para higiene futura:

1. `vitest` escanea `.next/standalone/src` como fuente: tras `npm run
   build`, el postbuild copia fuentes y tests a `.next/standalone`, y
   `npm test` los recoge como suites duplicadas. En DW.1 hubo que
   limpiar esa copia a mano para que `npm test` diera rc=0.
2. `dev-r34.pid` (artefacto de runtime) queda como untracked declarado
   fuera de baseline; corresponde ignorarlo para que el árbol quede
   limpio de forma sostenible.

DW.2 cierra ambas con un cambio de configuración mínimo y sin tocar
código de aplicación.

## 2. Cambio pre-registrado

Dos ficheros, además de este pre-registro:

1. **`vitest.config.ts`** (nuevo): configuración de vitest con
   `test.exclude = [...configDefaults.exclude, '.next/**']`, importando
   `defineConfig` y `configDefaults` de `vitest/config`. Sin otros
   ajustes (sin cambiar include, entorno, timeout ni cobertura).
2. **`.gitignore`**: una línea nueva, `dev-r34.pid`, bajo la sección de
   artefactos de runtime.

Fuera de alcance: `package.json`, `next.config.ts`, `tsconfig.json`,
fuentes de `src/`, dependencias, `data/**`, `.github/**`.

## 3. Criterio de aceptación (binario, pre-registrado)

**PASS** solo si todo se cumple, ejecutado en este orden sobre el head
del change:

1. `npm run build` → **rc=0** (genera `.next/standalone/src`).
2. `npm run lint` → **rc=0**.
3. `npm test` → **rc=0**, sin limpieza manual previa de `.next/`, con
   **48 ficheros / 461 tests / 0 fallos** y **ninguna suite bajo
   `.next/`** en la salida.
4. `git status --porcelain` → sin `dev-r34.pid` ni rastros del build;
   solo los ficheros cambiados por el slice si aún no están commiteados.

Cualquier desviación (test duplicado, rc≠0, fichero inesperado) es
**FAIL**, sin merge.

## 4. Instrumentos y evidencia

- Head de partida: `0961a57`. Head del change: el que resulte del
  commit, con padre inmediato `0961a57`.
- Evidencia: logs de `build`, `lint` y `test` en ese orden (con el
  `.next/` intacto), diff de los dos ficheros de configuración, salida
  de `git status`, y conteo de suites para demostrar que no aparece
  `.next/standalone`.
- Gate: acta de GLM sobre el head exacto del change + GO de David antes
  del merge, con el mismo patrón de DW.1. Sin CI en el repo web: la
  evidencia es local y se ferrya, como en DW.1.

## 5. Referencias

- Acta `0451` §3 (observaciones 1 y 2).
- Acta `0448` §5 (track DW, pre-registro por slice y mismo gate).
- Baseline web `f7771da`; head tras DW.1 `0961a57`; rama
  `dw.1-revert-toggles` conservada en `713fcf4`.
