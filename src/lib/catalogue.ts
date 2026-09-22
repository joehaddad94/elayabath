/**
 * The only module that reads `data/`.
 *
 * Pages and components go through these functions, never the JSON directly.
 * That is the seam: if the catalogue ever moves to a database or a CMS, this
 * file changes and nothing else does.
 *
 * Everything here is synchronous and pure. The data is committed JSON bundled
 * at build time, so there is nothing to await and nothing to cache.
 */
import categoriesData from "../../data/categories.json" with { type: "json" };
import finishesData from "../../data/finishes.json" with { type: "json" };
import metaData from "../../data/meta.json" with { type: "json" };
import productsData from "../../data/products.json" with { type: "json" };
import type { CatalogueMeta, Category, Finish, Product } from "./types";

const products = productsData as Product[];
const categories = categoriesData as Category[];
const finishes = finishesData as Finish[];
const meta = metaData as CatalogueMeta;

const productBySlug = new Map(products.map((p) => [p.slug, p]));
const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
const finishBySlug = new Map(finishes.map((f) => [f.slug, f]));

/* ── products ───────────────────────────────────────────────────────── */

export function getProducts(): Product[] {
  return products;
}

export function getProduct(slug: string): Product | undefined {
  return productBySlug.get(slug);
}

export function getProductsInCategory(categorySlug: string): Product[] {
  return products.filter((p) => p.categorySlug === categorySlug);
}

/**
 * Products worth showing beside this one. The live site calls this "Similar
 * products" and fills it with anything sharing a category, which is how a
 * 1.7m bathtub ends up recommended under a soap dish. Preferring the same
 * product type first is a low bar that it still fails.
 */
export function getRelatedProducts(product: Product, limit = 4): Product[] {
  const others = products.filter((p) => p.slug !== product.slug);
  const sameType = others.filter(
    (p) => p.categorySlug === product.categorySlug && p.type.slug === product.type.slug,
  );
  const sameCategory = others.filter(
    (p) => p.categorySlug === product.categorySlug && p.type.slug !== product.type.slug,
  );
  return [...sameType, ...sameCategory].slice(0, limit);
}

/* ── categories ─────────────────────────────────────────────────────── */

export function getCategories(): Category[] {
  return categories;
}

export function getCategory(slug: string): Category | undefined {
  return categoryBySlug.get(slug);
}

/* ── finishes ───────────────────────────────────────────────────────── */

export function getFinishes(): Finish[] {
  return finishes;
}

export function getFinish(slug: string): Finish | undefined {
  return finishBySlug.get(slug);
}

/** This product's finishes, in the order the client lists them, with any
 *  that no longer resolve quietly dropped rather than rendering blank. */
export function getFinishesFor(product: Product): Finish[] {
  return product.finishes
    .map((slug) => finishBySlug.get(slug))
    .filter((f): f is Finish => Boolean(f));
}

/* ── misc ───────────────────────────────────────────────────────────── */

/** Counts for the whole client catalogue, not just what this build ships.
 *  Used wherever the site states a number, so it never overclaims. */
export function getCatalogueMeta(): CatalogueMeta {
  return meta;
}
