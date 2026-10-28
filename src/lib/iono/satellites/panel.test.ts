// SPDX-License-Identifier: GPL-3.0-or-later
// ionosphere-live-3d — TU del contrato del panel del eco 2026 (drop 321,
// F2b #10, ruling 320): label byte a byte, "unavailable" -> "no data" y
// fallo de cliente -> estado separado "no connection to the route".

import { describe, expect, it } from "vitest";
import { buildPayload, sourceLabel, type CatalogPayload } from "./catalog";
import { SAT_ERR_TEXT, SAT_NA_TEXT, satPanelState } from "./panel";

function payload(source: "celestrak" | "satnogs" | "snapshot" | "unavailable"): CatalogPayload {
  return buildPayload(source, { records: [], dropped: 3 }, 111);
}

describe("satPanelState", () => {
  it("sin payload y sin fallo: cargando", () => {
    expect(satPanelState(null, false)).toEqual({ kind: "loading" });
  });

  it("fallo de cliente: estado separado con el texto del ruling", () => {
    const st = satPanelState(null, true);
    expect(st).toEqual({ kind: "error", text: "no connection to the route" });
    expect(SAT_ERR_TEXT).toBe("no connection to the route");
  });

  it('source "unavailable": texto "no data" (jamas se pinta label)', () => {
    const st = satPanelState(payload("unavailable"), false);
    expect(st.kind).toBe("unavailable");
    if (st.kind === "unavailable") {
      expect(st.text).toBe(SAT_NA_TEXT);
      expect(st.text).toBe("no data");
    }
  });

  it("label byte a byte para las cuatro fuentes (passthrough sin re-derivar)", () => {
    expect(sourceLabel("celestrak")).toBe("CelesTrak (live)");
    expect(sourceLabel("satnogs")).toBe("SatNOGS (live)");
    expect(sourceLabel("snapshot")).toBe("snapshot 2026-10-17 (no live)");
    for (const source of ["celestrak", "satnogs", "snapshot"] as const) {
      const p = payload(source);
      const st = satPanelState(p, false);
      expect(st.kind).toBe("ok");
      if (st.kind === "ok") {
        expect(st.label).toBe(p.sourceLabel);
        expect(st.attribution).toBe(p.attribution);
        expect(st.count).toBe(p.count);
        expect(st.dropped).toBe(3);
        expect(st.fetchedAt).toBe(p.fetchedAt);
      }
    }
  });

  it("un payload sano gana al flag de fallo (dato viejo etiquetado > error)", () => {
    const st = satPanelState(payload("snapshot"), true);
    expect(st.kind).toBe("ok");
  });
});
