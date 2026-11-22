# DW.1 — Pre-registro: revert de los toggles temporales de medición (web)

> Estado: **PRE-REGISTRO** — pendiente de acta de GLM y GO de David antes
> de tocar código.
> Repo: `valledemena/ionosphere-live-3d-web`. Baseline exacta:
> **`f7771dafc93338aee4051f4efe90e64cc67134ce`** (`main`, commit de
> baseline del acta `0448` §6).

## 1. Contexto

La baseline web incorpora `src/components/ionosphere/IonosphereScene.tsx`
con dos modificaciones temporales marcadas en el propio código como
`TEMP W11 (measurement only, revert)`:

- `?bloom=off` condiciona `composer.addPass(bloom)`.
- `?atmo=off` condiciona `scene.add(atmo.mesh)`.

El acta `0448` §6 fija que el marcador se cumple: **DW.1 = revert de los
toggles**, con criterio binario, o David los reclama explícitamente como
funcionalidad. No se ha reclamado: se revierten.

## 2. Cambio pre-registrado

Un único fichero, `src/components/ionosphere/IonosphereScene.tsx`:

1. Restaurar `composer.addPass(bloom);` sin condición por query param.
2. Restaurar `scene.add(atmo.mesh);` sin condición por query param.
3. Retirar los dos comentarios `TEMP W11` asociados.

Sin otros ficheros. `next-env.d.ts` ya quedó en la baseline como higiene;
`dev-r34.pid` queda declarado fuera de baseline, sin borrar.

## 3. Criterio de aceptación (binario, pre-registrado)

**PASS** solo si se cumplen las tres condiciones:

1. `grep -i` sobre `src/` de `bloom=off`, `atmo=off` y `TEMP W11` da
   **0 coincidencias**.
2. `npm run build` termina con éxito.
3. `npm run lint` termina con éxito y `npm test` (vitest) termina con
   éxito.

Cualquier coincidencia residual o fallo de build/lint/test es **FAIL**
y el slice no se fusiona. El diff debe ser exactamente el revert de las
dos condicionales y sus comentarios (+/− mínimo, sin cambios colaterales).

## 4. Instrumentos y evidencia

- Head exacto de partida: `f7771da`.
- Head exacto del change: el que resulte del commit de revert; se relaya
  con el diff y los logs antes del GO.
- Evidencia: diff del fichero, salida de `grep`, logs de `build`, `lint` y
  `test`, y `git status` limpio aparte de `dev-r34.pid`.
- Gate: acta de GLM sobre el head exacto del change + GO de David antes
  del merge. Mismo patrón que R4; el hub documental sigue en el repo
  Android (`docs/TASKS.md`, `HANDOFF_ACTIVE.md`).

## 5. Fuera de alcance

- No se toca `next-env.d.ts`, `data/**`, `.github/**` ni dependencias.
- No se reanuda Android; `main` Android sigue en `59f539b`, aparcado.
- No se ejecuta ninguna otra acción del track DW.

## 6. Referencias

- Acta `0448` §5 (track DW) y §6.1 (baseline web y DW.1).
- Acta `0449` §5.4 (secuencia pos-merge: pre-registro DW.1 con acta y GO).
- Baseline web `f7771da`; baseline C++ `e680d01` publicada en
  `baseline/dw-cpp-20261122`.
