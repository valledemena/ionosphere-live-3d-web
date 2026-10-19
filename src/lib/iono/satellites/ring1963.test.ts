// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — TU del anillo West Ford 1963 (drop 321 + micro-drop
// 323, F2b #10, ruling 320 / verdict 322 §6.1). La banda es determinista,
// vive en 3600..3680 km y yace en UN plano casi polar a 87.4 grados (nodo
// fijo declarado + jitter de espesor en nodo e inclinacion).

import { describe, expect, it } from "vitest";
import { R_EARTH_KM } from "../geo";
import {
  RING_ALT_KM_MAX,
  RING_ALT_KM_MIN,
  RING_INC_DEG,
  RING_LABEL,
  RING_NODE_DEG,
  RING_PARTICLES,
  buildRing1963,
} from "./ring1963";

describe("buildRing1963", () => {
  it("todas las particulas viven en la banda de altitud declarada", () => {
    const pos = buildRing1963();
    expect(pos.length).toBe(RING_PARTICLES * 3);
    const lo = 1 + RING_ALT_KM_MIN / R_EARTH_KM;
    const hi = 1 + RING_ALT_KM_MAX / R_EARTH_KM;
    for (let i = 0; i < RING_PARTICLES; i++) {
      const r = Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      expect(r).toBeGreaterThanOrEqual(lo - 1e-6);
      expect(r).toBeLessThanOrEqual(hi + 1e-6);
    }
  });

  it("banda casi polar: |lat| cerca de la inclinacion 87.4 (no ecuatorial)", () => {
    const pos = buildRing1963();
    let maxAbsLat = 0;
    for (let i = 0; i < RING_PARTICLES; i++) {
      const r = Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      const lat = Math.abs((Math.asin(pos[i * 3 + 1] / r) * 180) / Math.PI);
      maxAbsLat = Math.max(maxAbsLat, lat);
    }
    expect(maxAbsLat).toBeLessThanOrEqual(RING_INC_DEG + 0.7);
    expect(maxAbsLat).toBeGreaterThan(85);
  });

  it("plano unico: todas las particulas yacen en el plano declarado (jitter <= 1.5 grados)", () => {
    const pos = buildRing1963();
    const deg = Math.PI / 180;
    const inc = RING_INC_DEG * deg;
    const node = RING_NODE_DEG * deg;
    const nx = Math.sin(inc) * Math.cos(node);
    const ny = Math.cos(inc);
    const nz = Math.sin(inc) * Math.sin(node);
    const bound = Math.sin(1.5 * deg);
    for (let i = 0; i < RING_PARTICLES; i++) {
      const x = pos[i * 3];
      const y = pos[i * 3 + 1];
      const z = pos[i * 3 + 2];
      const r = Math.hypot(x, y, z);
      expect(Math.abs((x * nx + y * ny + z * nz) / r)).toBeLessThanOrEqual(bound);
    }
  });

  it("determinista: dos builds son identicos byte a byte", () => {
    expect(Array.from(buildRing1963(256))).toEqual(Array.from(buildRing1963(256)));
  });

  it("etiqueta exacta del ruling 320 (dos sitios: panel + leyenda)", () => {
    expect(RING_LABEL).toBe(
      "West Ford 1963 — reconstrucción declarada (sin datos vivos)",
    );
  });
});
