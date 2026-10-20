/**
 * TU drop 350: integridad del catálogo de ideas — ids únicos, contadores
 * coherentes y coherencia parcial/missing (nada de propuesta mentirosa).
 * Puro: sin DOM.
 */
import { describe, expect, it } from "vitest";
import {
  IDEAS,
  countIdeasByStatus,
  REVIEW_SNAPSHOT,
  type IdeaItem,
} from "./ideasData";

describe("ideasData: integridad del catálogo (drop 350)", () => {
  it("ids unicos", () => {
    const ids = IDEAS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contadores derivados suman el total", () => {
    const c = countIdeasByStatus();
    expect(c.demo + c.parcial + c.propuesta + c.aplazada).toBe(IDEAS.length);
    for (const s of ["demo", "parcial", "propuesta", "aplazada"] as const) {
      expect(c[s]).toBe(IDEAS.filter((i) => i.status === s).length);
    }
  });

  it("toda idea 'parcial' declara missing no vacio; nadie mas lo lleva", () => {
    for (const i of IDEAS as IdeaItem[]) {
      if (i.status === "parcial") {
        expect(i.missing, `${i.id} parcial sin missing`).toBeTruthy();
        expect(i.missing!.length).toBeGreaterThan(10);
      } else {
        expect(i.missing, `${i.id} no-parcial con missing`).toBeUndefined();
      }
    }
  });

  it("snapshot de revision con formato YYYY-MM-DD", () => {
    expect(REVIEW_SNAPSHOT).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("todo id del catalogo es un slug estable", () => {
    for (const i of IDEAS) expect(i.id).toMatch(/^[a-z][a-z0-9]*$/);
  });
});
