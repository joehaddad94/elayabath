import { describe, expect, it } from "vitest";
import { productForm, slugFromSku } from "./product-schema";

const valid = {
  sku: "E01-SW10001",
  slug: "e01-sw10001",
  name: "PONTUS",
  category_id: "00000000-0000-4000-8000-000000000001",
  type_id: null,
  description: "",
  dimensions: "",
  features: [],
  status: "active" as const,
  featured: false,
  finishes: [],
};

describe("slugFromSku", () => {
  it("gives the address the seed gives", () => {
    expect(slugFromSku("E01-SW10001")).toBe("e01-sw10001");
    expect(slugFromSku(" E06-SW10353 A+ E06-SW10353 B ")).toBe("e06-sw10353_a_e06-sw10353_b");
  });
});

describe("productForm", () => {
  it("accepts a product with only the required fields", () => {
    expect(productForm.safeParse(valid).success).toBe(true);
  });

  it("stores empty dimensions as nothing, not an empty string", () => {
    expect(productForm.parse(valid).dimensions).toBeNull();
  });

  it("drops blank feature lines", () => {
    expect(productForm.parse({ ...valid, features: ["One", " ", "Two"] }).features).toEqual(["One", "Two"]);
  });

  it("accepts item codes that name a pair", () => {
    expect(productForm.safeParse({ ...valid, sku: "E06-SW10353 A+ E06-SW10353 B" }).success).toBe(true);
  });

  it("refuses an address with capitals or spaces", () => {
    expect(productForm.safeParse({ ...valid, slug: "Not A Slug" }).success).toBe(false);
  });

  it("refuses a finish listed twice", () => {
    const id = "00000000-0000-4000-8000-00000000f001";
    expect(productForm.safeParse({ ...valid, finishes: [id, id] }).success).toBe(false);
  });

  it("refuses an empty name", () => {
    expect(productForm.safeParse({ ...valid, name: "  " }).success).toBe(false);
  });
});
