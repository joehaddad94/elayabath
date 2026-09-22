import { describe, expect, test } from "vitest";
import { groupFinishesByFamily } from "./finishes";
import type { Finish } from "./types";

const finish = (slug: string, family: Finish["family"], familyName: string): Finish => ({
  slug,
  code: slug.slice(0, 3).toUpperCase(),
  name: slug,
  family,
  familyName,
  image: null,
});

describe("groupFinishesByFamily", () => {
  test("groups by material and leads with the largest group", () => {
    const groups = groupFinishesByFamily([
      finish("m00", "marble", "Marble"),
      finish("c00", "ceramic", "Ceramic"),
      finish("c01", "ceramic", "Ceramic"),
      finish("c02", "ceramic", "Ceramic"),
      finish("ss00", "solid-surface", "Solid surface"),
      finish("ss01", "solid-surface", "Solid surface"),
    ]);
    expect(groups.map((g) => [g.familyName, g.finishes.length])).toEqual([
      ["Ceramic", 3],
      ["Solid surface", 2],
      ["Marble", 1],
    ]);
  });

  test("breaks a tie by name so the order is stable across builds", () => {
    const groups = groupFinishesByFamily([
      finish("ss00", "solid-surface", "Solid surface"),
      finish("c00", "ceramic", "Ceramic"),
    ]);
    expect(groups.map((g) => g.familyName)).toEqual(["Ceramic", "Solid surface"]);
  });

  test("keeps the client's order within a group", () => {
    const groups = groupFinishesByFamily([
      finish("c02", "ceramic", "Ceramic"),
      finish("c00", "ceramic", "Ceramic"),
    ]);
    expect(groups[0]?.finishes.map((f) => f.slug)).toEqual(["c02", "c00"]);
  });

  test("returns nothing for a product with no finishes", () => {
    expect(groupFinishesByFamily([])).toEqual([]);
  });
});
