/**
 * The only module that reads catalogue data.
 *
 * Pages and components go through these functions, never the data source
 * directly. That is the seam: when the catalogue moves to the database, this
 * file changes and nothing else does.
 *
 * Every function is async, although today each one resolves immediately from
 * committed JSON. That is deliberate. A database read is async, and making
 * every caller await now means the move to Supabase changes the body of these
 * functions and not the eight files that call them.
 */
import categoriesData from "../../data/categories.json" with { type: "json" };
import finishesData from "../../data/finishes.json" with { type: "json" };
import metaData from "../../data/meta.json" with { type: "json" };
import productsData from "../../data/products.json" with { type: "json" };
import searchData from "../../data/search.json" with { type: "json" };
import type { CatalogueMeta, Category, Finish, Product, SearchEntry } from "./types";

const products = productsData as Product[];
const categories = categoriesData as Category[];
const finishes = finishesData as Finish[];
const meta = metaData as CatalogueMeta;
const searchIndex = searchData as SearchEntry[];

const productBySlug = new Map(products.map((p) => [p.slug, p]));
const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
const finishBySlug = new Map(finishes.map((f) => [f.slug, f]));

/* ── products ───────────────────────────────────────────────────────── */

export async function getProducts(): Promise<Product[]> {
  return products;
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  return productBySlug.get(slug);
}

export async function getProductsInCategory(categorySlug: string): Promise<Product[]> {
  return products.filter((p) => p.categorySlug === categorySlug);
}

/**
 * Products worth showing beside this one. The live site calls this "Similar
 * products" and fills it with anything sharing a category, which is how a
 * 1.7m bathtub ends up recommended under a soap dish. Preferring the same
 * product type first is a low bar that it still fails.
 */
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
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

export async function getCategories(): Promise<Category[]> {
  return categories;
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  return categoryBySlug.get(slug);
}

/* ── finishes ───────────────────────────────────────────────────────── */

export async function getFinishes(): Promise<Finish[]> {
  return finishes;
}

export async function getFinish(slug: string): Promise<Finish | undefined> {
  return finishBySlug.get(slug);
}

/** This product's finishes, in the order the client lists them, with any
 *  that no longer resolve quietly dropped rather than rendering blank. */
export async function getFinishesFor(product: Product): Promise<Finish[]> {
  return product.finishes
    .map((slug) => finishBySlug.get(slug))
    .filter((f): f is Finish => Boolean(f));
}

/* ── search ─────────────────────────────────────────────────────────── */

/** The compact index the search page matches against. Served to the browser
 *  by `app/api/search-index/route.ts`, so no client code ever imports it. */
export async function getSearchIndex(): Promise<SearchEntry[]> {
  return searchIndex;
}

/* ── misc ───────────────────────────────────────────────────────────── */

/** Counts for the whole client catalogue, not just what this build ships.
 *  Used wherever the site states a number, so it never overclaims. */
export async function getCatalogueMeta(): Promise<CatalogueMeta> {
  return meta;
}
