import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_LIMIT,
  breadcrumbSchema,
  clampDescription,
  faqSchema,
  productSchema,
} from "./seo";
import type { Product } from "./types";

describe("clampDescription", () => {
  it("leaves short text alone", () => {
    expect(clampDescription("Washbasins from Elaya Bath.")).toBe(
      "Washbasins from Elaya Bath.",
    );
  });

  it("never exceeds the limit", () => {
    const long = "Sentence one is here. " + "word ".repeat(100);
    expect(clampDescription(long).length).toBeLessThanOrEqual(DESCRIPTION_LIMIT);
  });

  it("prefers a sentence break so the result reads as written", () => {
    const text =
      "Our washbasins are made from ceramic, solid surface and marble in a range of finishes. " +
      "They suit both residential and commercial installations across the region and beyond.";
    const out = clampDescription(text);
    expect(out.endsWith(".")).toBe(true);
    expect(out).not.toContain("…");
  });

  it("falls back to a word break when no sentence fits", () => {
    const out = clampDescription("word ".repeat(80));
    expect(out.endsWith("…")).toBe(true);
    expect(out).not.toMatch(/\s…$/);
  });

  it("collapses whitespace, so a wrapped blurb is measured by its text", () => {
    expect(clampDescription("a\n  b\tc")).toBe("a b c");
  });
});

describe("structured data", () => {
  const product = {
    sku: "EB-1000",
    slug: "eb-1000",
    name: "Alco",
    categoryName: "Washbasins",
    dimensions: "600 x 350 mm",
    description: "A countertop basin.",
    image: { src: "/products/eb-1000.webp", width: 800, height: 800, alt: "Alco" },
  } as Product;

  it("emits absolute URLs, because a crawler has no page context", () => {
    const schema = productSchema(product, "/product/eb-1000");
    expect(schema.url).toBe("https://elayabath.com/product/eb-1000");
    expect(schema.image).toBe("https://elayabath.com/products/eb-1000.webp");
  });

  it("claims no price, because the source data has none that is real", () => {
    expect(productSchema(product, "/product/eb-1000")).not.toHaveProperty("offers");
  });

  it("numbers breadcrumb positions from one and omits the item for the leaf", () => {
    const schema = breadcrumbSchema([
      { name: "Products", href: "/products" },
      { name: "Alco" },
    ]);
    expect(schema.itemListElement.map((s) => s.position)).toEqual([1, 2]);
    expect(schema.itemListElement[1]).not.toHaveProperty("item");
  });

  it("pairs every question with its answer", () => {
    const schema = faqSchema([{ q: "Why?", a: "Because." }]);
    expect(schema.mainEntity[0]?.name).toBe("Why?");
    expect(schema.mainEntity[0]?.acceptedAnswer.text).toBe("Because.");
  });
});
