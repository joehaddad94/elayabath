import { describe, expect, test } from "vitest";
import { searchCatalogue } from "./search";
import type { SearchEntry } from "./types";

const index: SearchEntry[] = [
  { s: "e02-sw40034", n: "ANELLO", k: "E02-SW40034", t: "Above Counter Washbasin", c: "Washbasins" },
  { s: "e01-sw10114", n: "ARCO", k: "E01-SW10114", t: "Above Counter Washbasin", c: "Washbasins" },
  { s: "e06-sw10413", n: "AXE C", k: "E06-SW10413", t: "Wall Hung WC", c: "Toilets" },
  { s: "e05-sf20073", n: "ARIA", k: "E05-SF20073", t: "Basin mixer", c: "Tapware" },
];

describe("searchCatalogue", () => {
  test("an exact item code outranks everything", () => {
    // The specifier arriving from a drawing has one right answer.
    expect(searchCatalogue(index, "E01-SW10114")[0]?.entry.n).toBe("ARCO");
  });

  test("an item code matches with its punctuation stripped", () => {
    expect(searchCatalogue(index, "e01 sw10114")[0]?.entry.n).toBe("ARCO");
  });

  test("matches on name, type and category as well as code", () => {
    expect(searchCatalogue(index, "tapware").map((h) => h.entry.n)).toEqual(["ARIA"]);
    expect(searchCatalogue(index, "wall hung").map((h) => h.entry.n)).toEqual(["AXE C"]);
  });

  test("every term must match, so adding a word narrows", () => {
    expect(searchCatalogue(index, "washbasin")).toHaveLength(2);
    expect(searchCatalogue(index, "washbasin arco")).toHaveLength(1);
  });

  test("an empty or whitespace query returns nothing, not everything", () => {
    expect(searchCatalogue(index, "")).toEqual([]);
    expect(searchCatalogue(index, "   ")).toEqual([]);
  });

  test("no match returns empty rather than near misses", () => {
    // The reason matching is exact rather than fuzzy.
    expect(searchCatalogue(index, "E01-SW99999")).toEqual([]);
  });

  test("respects the result limit", () => {
    expect(searchCatalogue(index, "washbasins", 1)).toHaveLength(1);
  });

  test("is case insensitive", () => {
    expect(searchCatalogue(index, "anello")[0]?.entry.k).toBe("E02-SW40034");
  });
});
