import { describe, expect, it } from "vitest";
import { isActive } from "./nav";

describe("isActive", () => {
  it("matches a page against its own href", () => {
    expect(isActive("/about", "/about")).toBe(true);
  });

  it("ignores a locale segment the rewrite hides from the address bar", () => {
    // The regression this whole module exists for: usePathname() reports
    // "/en/about" while the href is "/about", so a direct comparison was
    // false on every route and nothing in the header was ever marked.
    expect(isActive("/en/about", "/about")).toBe(true);
    expect(isActive("/en/products", "/products")).toBe(true);
  });

  it("lights up a section from one of its child pages", () => {
    expect(isActive("/en/products/washbasins", "/products")).toBe(true);
  });

  it("lights up Products from a product detail page", () => {
    // /product/<slug> is singular and is not under /products, so this only
    // works because the extra root is passed explicitly.
    expect(isActive("/en/product/e01-sw10114", "/products", ["/product"])).toBe(true);
  });

  it("does not match a different section that shares a prefix", () => {
    expect(isActive("/en/products", "/product", [])).toBe(false);
    expect(isActive("/en/catalogue", "/contact")).toBe(false);
  });

  it("treats home as exact, so it is not active on every page", () => {
    expect(isActive("/en", "/")).toBe(true);
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/en/about", "/")).toBe(false);
  });
});
