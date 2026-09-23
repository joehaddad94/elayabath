import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  appliedFilters,
  countSelected,
  facetCounts,
  filterProducts,
  isSortKey,
  sortProducts,
} from "./product-filters";
import type { Product } from "./types";

const make = (
  sku: string,
  name: string,
  type: string,
  materials: string[],
  finishes: string[],
) =>
  ({
    sku,
    slug: sku.toLowerCase(),
    name,
    type: { slug: type, name: type },
    materials,
    finishes,
  }) as unknown as Product;

const products = [
  make("E10", "Brisa", "free-standing", ["ceramic"], ["c00-white"]),
  make("E2", "Arco", "above-counter", ["solid-surface"], ["ss04-thunder", "ss00"]),
  make("E30", "Dropo", "free-standing", ["ceramic", "marble"], ["c00-white", "m01"]),
];

describe("filterProducts", () => {
  it("returns everything when nothing is selected", () => {
    expect(filterProducts(products, EMPTY_SELECTION)).toHaveLength(3);
  });

  it("treats values within one axis as either/or", () => {
    const hit = filterProducts(products, {
      ...EMPTY_SELECTION,
      type: ["free-standing", "above-counter"],
    });
    expect(hit).toHaveLength(3);
  });

  it("treats separate axes as both", () => {
    const hit = filterProducts(products, {
      type: ["free-standing"],
      material: ["marble"],
      colour: [],
    });
    expect(hit.map((p) => p.name)).toEqual(["Dropo"]);
  });

  it("can select down to nothing", () => {
    const hit = filterProducts(products, {
      type: ["above-counter"],
      material: ["marble"],
      colour: [],
    });
    expect(hit).toHaveLength(0);
  });
});

describe("facetCounts", () => {
  const options = [
    { value: "ceramic", label: "Ceramic", count: 99 },
    { value: "marble", label: "Marble", count: 99 },
    { value: "solid-surface", label: "Solid surface", count: 99 },
  ];

  it("replaces the static catalogue totals it is given", () => {
    const counts = facetCounts(products, EMPTY_SELECTION, "material", options);
    expect(counts.map((c) => c.count)).toEqual([2, 1, 1]);
  });

  it("narrows with a selection on another axis", () => {
    // Only the two free-standing products are in play, and both are ceramic.
    const counts = facetCounts(
      products,
      { ...EMPTY_SELECTION, type: ["free-standing"] },
      "material",
      options,
    );
    expect(counts.find((c) => c.value === "ceramic")?.count).toBe(2);
    expect(counts.find((c) => c.value === "solid-surface")?.count).toBe(0);
  });

  it("ignores the axis being counted, so an option never reads zero once ticked", () => {
    const counts = facetCounts(
      products,
      { ...EMPTY_SELECTION, material: ["marble"] },
      "material",
      options,
    );
    expect(counts.find((c) => c.value === "ceramic")?.count).toBe(2);
  });
});

describe("sortProducts", () => {
  it("leaves the client's own order alone by default", () => {
    expect(sortProducts(products, "default").map((p) => p.name)).toEqual([
      "Brisa",
      "Arco",
      "Dropo",
    ]);
  });

  it("sorts by name in both directions", () => {
    expect(sortProducts(products, "name").map((p) => p.name)).toEqual([
      "Arco",
      "Brisa",
      "Dropo",
    ]);
    expect(sortProducts(products, "name-desc").map((p) => p.name)[0]).toBe("Dropo");
  });

  it("puts the most choice first when sorting by finishes", () => {
    expect(sortProducts(products, "finishes").map((p) => p.name)[0]).toBe("Arco");
  });

  it("compares item codes numerically, so E2 precedes E10", () => {
    expect(sortProducts(products, "code").map((p) => p.sku)).toEqual([
      "E2",
      "E10",
      "E30",
    ]);
  });

  it("does not mutate the array it is given", () => {
    const original = [...products];
    sortProducts(products, "name");
    expect(products).toEqual(original);
  });
});

describe("selection helpers", () => {
  it("counts every selected value across axes", () => {
    expect(
      countSelected({ type: ["a"], material: ["b", "c"], colour: [] }),
    ).toBe(3);
    expect(countSelected(EMPTY_SELECTION)).toBe(0);
  });

  it("labels applied filters, falling back to the raw value", () => {
    const labels = {
      type: new Map([["free-standing", "Free standing"]]),
      material: new Map<string, string>(),
      colour: new Map<string, string>(),
    };
    const chips = appliedFilters(
      { type: ["free-standing"], material: ["marble"], colour: [] },
      labels,
    );
    expect(chips).toEqual([
      { axis: "type", value: "free-standing", label: "Free standing" },
      { axis: "material", value: "marble", label: "marble" },
    ]);
  });

  it("recognises only the sort keys it defines", () => {
    expect(isSortKey("name")).toBe(true);
    expect(isSortKey("price")).toBe(false);
  });
});
