import { describe, expect, test } from "vitest";
import {
  cleanDescription,
  findDatasheetUrl,
  parseDimensions,
  parseFeatures,
  parseFinish,
  parseFinishSlugs,
  slugify,
  slugifySku,
} from "./parse.ts";

/**
 * Every case here is a real record from the client's catalogue, not an
 * invented one. The parsing exists because their data is inconsistent, so
 * testing it against tidy input would prove nothing.
 */

describe("slugifySku", () => {
  test("handles the two-codes-in-one-field pair", () => {
    // A basin and pedestal sold together. Not a filename, not a URL.
    expect(slugifySku("E06-SW10353 A+ E06-SW10353 B")).toBe(
      "e06-sw10353_a_e06-sw10353_b",
    );
  });

  test("leaves an ordinary code alone but for case", () => {
    expect(slugifySku("E02-SW40034")).toBe("e02-sw40034");
  });

  test("never leaves a leading or trailing separator", () => {
    expect(slugifySku("  +E01-SW10114+  ")).toBe("e01-sw10114");
  });
});

describe("parseFinish", () => {
  test("splits code, name and material from the slug", () => {
    expect(parseFinish("c00-white")).toMatchObject({
      code: "C00",
      name: "White",
      family: "ceramic",
    });
  });

  test("maps every code prefix onto its material", () => {
    const families = [
      ["a00-white", "acrylic"],
      ["c01-black", "ceramic"],
      ["cr00-concrete", "concrete"],
      ["m05-travertine", "marble"],
      ["p00-chrome", "plating"],
      ["rt00-rf00-crystal", "resin"],
      ["ss13-gypsophila", "solid-surface"],
    ] as const;
    for (const [slug, family] of families) {
      expect(parseFinish(slug)?.family, slug).toBe(family);
    }
  });

  test("unwraps a resin slug that double-encodes its own code", () => {
    expect(parseFinish("rt00-rf00-crystal")).toMatchObject({
      code: "RT00",
      name: "Crystal",
    });
  });

  test("preserves the client's typos rather than correcting them", () => {
    // Their swatch file says MOUNTAIN; the attribute slug says MOUTAIN. The
    // name follows the slug so the mistake stays visible to whoever has to
    // fix it at source.
    expect(parseFinish("rt12-rf12-yellow-moutain-2")?.name).toBe(
      "Yellow Moutain",
    );
  });

  test("drops a disambiguating numeric suffix", () => {
    expect(parseFinish("c09-grey-2")?.name).toBe("Grey");
  });

  test("returns null for anything that is not a colour code", () => {
    expect(parseFinish("not-a-code")).toBeNull();
    expect(parseFinish("")).toBeNull();
  });
});

describe("cleanDescription", () => {
  test("strips the leading label and collapses the run-on line", () => {
    expect(
      cleanDescription("Description   ABOVE COUNTER WASHBASIN\n\n WITHOUT TAP HOLE"),
    ).toBe("ABOVE COUNTER WASHBASIN WITHOUT TAP HOLE");
  });

  test("survives a missing description", () => {
    expect(cleanDescription(undefined)).toBe("");
  });
});

describe("parseDimensions", () => {
  test("reads the three-axis form", () => {
    expect(parseDimensions("DIMENSION:600X350X150 MM")).toBe("600 x 350 x 150 mm");
  });

  test("reads a two-axis form", () => {
    expect(parseDimensions("DIMENSION: 385 X 385")).toBe("385 x 385 mm");
  });

  test("accepts the unicode multiplication sign", () => {
    expect(parseDimensions("DIMENSION: 500×400×135 MM")).toBe(
      "500 x 400 x 135 mm",
    );
  });

  test("returns null when the client never published one", () => {
    expect(parseDimensions("TOWELR RING")).toBeNull();
  });
});

describe("parseFeatures", () => {
  test("picks out the features present, in a stable order", () => {
    expect(
      parseFeatures("ABOVE COUNTER WASHBASIN WITHOUT TAP HOLE WITHOUT OVERFLOW CENTER OUTLET"),
    ).toEqual(["Without Tap Hole", "Without Overflow", "Center Outlet"]);
  });

  test("finds nothing in a description that lists none", () => {
    expect(parseFeatures("PAPER HOLDER")).toEqual([]);
  });
});

describe("parseFinishSlugs", () => {
  test("keeps the client's order and de-duplicates", () => {
    expect(
      parseFinishSlugs({
        variations: [
          { attributes: { attribute_pa_colors: "c00-white" } },
          { attributes: { attribute_pa_colors: "c01-black" } },
          { attributes: { attribute_pa_colors: "c00-white" } },
          { attributes: { attribute_pa_materials: "ceramic" } },
        ],
      }),
    ).toEqual(["c00-white", "c01-black"]);
  });

  test("returns empty for a product with no variations", () => {
    expect(parseFinishSlugs({})).toEqual([]);
  });
});

describe("findDatasheetUrl", () => {
  test("takes the url from the page rather than constructing it", () => {
    // Constructing it from the SKU gets the upload month wrong.
    expect(
      findDatasheetUrl(
        'href="https:\\/\\/elayabath.com\\/wp-content\\/uploads\\/2026\\/05\\/TDS-E05-AC40073.pdf"',
      ),
    ).toBe("https://elayabath.com/wp-content/uploads/2026/05/TDS-E05-AC40073.pdf");
  });

  test("returns null when the page references no sheet", () => {
    expect(findDatasheetUrl("<p>no documents here</p>")).toBeNull();
  });
});

describe("slugify", () => {
  test("makes a url-safe segment from a category name", () => {
    expect(slugify("Above Counter Washbasin")).toBe("above-counter-washbasin");
    expect(slugify("Urinal Seperator")).toBe("urinal-seperator");
  });
});
