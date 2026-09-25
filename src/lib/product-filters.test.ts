import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  appliedFilters,
  countSelected,
  isSortKey,
  shelfQuery,
} from "./product-filters";

// Filtering, facet counts and sorting are specified in
// supabase/tests/shelf.test.sql, against the database function that runs
// them. What stays in the browser is tested here.

describe("selection helpers", () => {
  it("counts every selected value across axes", () => {
    expect(countSelected({ type: ["a"], material: ["b", "c"], colour: [] })).toBe(3);
    expect(countSelected(EMPTY_SELECTION)).toBe(0);
  });

  it("labels applied filters, falling back to the raw value", () => {
    const labels = {
      type: new Map([["free-standing", "Free standing"]]),
      material: new Map<string, string>(),
      colour: new Map<string, string>(),
    };
    expect(
      appliedFilters({ type: ["free-standing"], material: ["marble"], colour: [] }, labels),
    ).toEqual([
      { axis: "type", value: "free-standing", label: "Free standing" },
      { axis: "material", value: "marble", label: "marble" },
    ]);
  });

  it("recognises only the sort keys it defines", () => {
    expect(isSortKey("name")).toBe(true);
    expect(isSortKey("price")).toBe(false);
  });
});

describe("shelfQuery", () => {
  it("omits empty axes and carries paging", () => {
    const q = new URLSearchParams(
      shelfQuery("washbasins", { type: ["a", "b"], material: [], colour: [] }, "name", 24, 24),
    );
    expect(q.get("category")).toBe("washbasins");
    expect(q.get("type")).toBe("a,b");
    expect(q.has("material")).toBe(false);
    expect(q.get("sort")).toBe("name");
    expect(q.get("offset")).toBe("24");
    expect(q.get("limit")).toBe("24");
  });
});
