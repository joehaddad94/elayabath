/**
 * The only module that reads the catalogue.
 *
 * Pages and components go through these functions, never the database
 * directly. That is the seam: it read committed JSON until the catalogue
 * moved to Supabase, and the pages calling it did not change when it did.
 *
 * Every read is cached and tagged (`'use cache'` with `cacheTag`). Nothing is
 * refetched on a timer: a read stays cached until a publish clears its tag,
 * so the site serves static pages and only the pages a publish touches are
 * rebuilt, on their next visit.
 *
 * Reads use the public client: no session, no cookies, and row-level security
 * limits it to the published read model whatever code calls it.
 *
 * The database stores paths inside Storage buckets; this module turns them
 * into URLs, so the Storage host can change without rewriting any data.
 */
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { HOMEPAGE_PRODUCTS } from "@/content/homepage";
import { categoryAsset } from "./site-content/fields";
import { tags } from "./cache-tags";
import type { Selection, SortKey } from "./product-filters";
import { storageUrl } from "./supabase/config";
import { publicClient } from "./supabase/public";
import {
  FINISH_FAMILY_NAMES,
  type CatalogueMeta,
  type Category,
  type Collection,
  type Finish,
  type FinishFamily,
  type Product,
  type ProductImage,
  type SearchResults,
  type ShelfPage,
} from "./types";

/* ── snapshots, as the publish functions write them ─────────────────── */

interface StoredImage {
  path: string;
  width: number | null;
  height: number | null;
  alt: string;
  caption?: string | null;
}

interface ProductSnapshot {
  sku: string;
  slug: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  type: { slug: string; name: string };
  dimensions: string | null;
  description: string;
  features: string[];
  /** Only visible products are on the site. */
  status: "active";
  image: StoredImage | null;
  gallery: StoredImage[];
  finishes: string[];
  finishImages: Record<string, string>;
  materials: FinishFamily[];
  datasheet: string | null;
}

interface CategorySnapshot {
  slug: string;
  name: string;
  blurb: string[];
  image: string | null;
  icon: string | null;
  position: number;
}

interface FinishSnapshot {
  slug: string;
  code: string;
  name: string;
  family: FinishFamily;
  image: string | null;
  status: "active" | "retired";
}

interface CollectionSnapshot {
  slug: string;
  name: string;
  description: string;
  categorySlug: string;
  categoryName: string;
  /** Its own photo, a path in site-media. */
  photo: string | null;
  /** Its first product's photo, as that product's snapshot holds it. */
  cover?: StoredImage | null;
  count?: number;
}

interface Facets {
  type: Array<{ value: string; label: string; count: number }>;
  material: Array<{ value: FinishFamily; count: number }>;
  colour: Array<{ value: string; count: number }>;
}

type Shelf = ShelfPage;

function toImage(image: StoredImage): ProductImage {
  return {
    src: storageUrl("product-media", image.path),
    width: image.width ?? 800,
    height: image.height ?? 800,
    alt: image.alt,
    ...(image.caption ? { caption: image.caption } : {}),
  };
}

function toProduct(s: ProductSnapshot): Product {
  return {
    sku: s.sku,
    slug: s.slug,
    name: s.name,
    categorySlug: s.categorySlug,
    categoryName: s.categoryName,
    type: s.type,
    dimensions: s.dimensions,
    description: s.description,
    features: s.features,
    status: s.status,
    image: s.image ? toImage(s.image) : null,
    gallery: (s.gallery ?? []).map(toImage),
    finishes: s.finishes,
    finishImages: Object.fromEntries(
      Object.entries(s.finishImages ?? {}).map(([finish, path]) => [
        finish,
        storageUrl("product-media", path),
      ]),
    ),
    materials: s.materials,
    datasheet: s.datasheet ? storageUrl("datasheets", s.datasheet) : null,
  };
}

/** A product snapshot, as `public.product_snapshot` builds it, in the site's
 *  shape. For the preview (lib/preview.ts), which reads the working copy
 *  and must render it exactly as publishing it would. */
export function productFromSnapshot(snapshot: unknown): Product {
  return toProduct(snapshot as ProductSnapshot);
}

function toCollection(s: CollectionSnapshot): Collection {
  const image: Collection["image"] = s.photo
    ? { src: storageUrl("site-media", s.photo), width: 1200, height: 900, alt: "", product: false }
    : s.cover
      ? { ...toImage(s.cover), alt: "", product: true }
      : null;
  return {
    slug: s.slug,
    name: s.name,
    description: s.description,
    categorySlug: s.categorySlug,
    categoryName: s.categoryName,
    image,
    count: s.count ?? 0,
  };
}

function toFinish(s: FinishSnapshot): Finish {
  return {
    slug: s.slug,
    code: s.code,
    name: s.name,
    family: s.family,
    familyName: FINISH_FAMILY_NAMES[s.family],
    image: s.image ? storageUrl("swatches", s.image) : null,
  };
}

function toFacets(f: Facets): Shelf["facets"] {
  return {
    type: f.type.map((t) => ({ value: t.value, label: t.label, count: t.count })),
    material: f.material.map((m) => ({
      value: m.value,
      label: FINISH_FAMILY_NAMES[m.value] ?? m.value,
      count: m.count,
    })),
    colour: f.colour,
  };
}

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`catalogue: ${what}: ${error?.message ?? "no data"}`);
}

/* ── products ───────────────────────────────────────────────────────── */

/** A product on the site by its current slug. A hidden product has none;
 *  an old slug is a redirect, looked up by the page. */
export async function getProduct(slug: string): Promise<Product | undefined> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.product(slug), tags.collections);

  const { data, error } = await publicClient()
    .from("published_products")
    .select("snapshot, collection:collections(slug, name)")
    .eq("slug", slug)
    .maybeSingle();
  if (error) fail(`product ${slug}`, error);
  if (!data) return undefined;
  const product = toProduct(data.snapshot as unknown as ProductSnapshot);
  return data.collection ? { ...product, collection: data.collection } : product;
}

/** Where an old slug now lives, if its product was renamed. */
export async function getRedirect(slug: string): Promise<string | undefined> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.products);

  const { data, error } = await publicClient()
    .from("redirects")
    .select("product_id")
    .eq("from_slug", slug)
    .maybeSingle();
  if (error) fail(`redirect ${slug}`, error);
  if (!data) return undefined;

  const target = await publicClient()
    .from("published_products")
    .select("slug")
    .eq("product_id", data.product_id)
    .maybeSingle();
  if (target.error) fail(`redirect target ${slug}`, target.error);
  return target.data?.slug ?? undefined;
}

/**
 * The homepage's products, in order, each with its product id (the hero is
 * chosen by id). `ids` is the list chosen in Site content; until someone
 * chooses, it is the fixed list in src/content/homepage.ts. Hidden or
 * deleted products drop out.
 */
export async function getHomepageProducts(
  ids: readonly string[] | null,
): Promise<Array<{ id: string; product: Product }>> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.products);

  const base = publicClient().from("published_products").select("product_id, slug, snapshot").eq("status", "active");
  const { data, error } = ids ? await base.in("product_id", [...ids]) : await base.in("slug", [...HOMEPAGE_PRODUCTS]);
  if (error) fail("homepage products", error);
  const rows = data ?? [];
  const byKey = new Map(rows.map((row) => [ids ? row.product_id : row.slug, row]));
  return (ids ?? HOMEPAGE_PRODUCTS).flatMap((key) => {
    const row = byKey.get(key);
    return row ? [{ id: row.product_id, product: toProduct(row.snapshot as unknown as ProductSnapshot) }] : [];
  });
}

/** Every live product's slug, for the sitemap. Slugs only: the sitemap has
 *  no use for 600 full records. */
export async function getProductSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.products);

  const slugs: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await publicClient()
      .from("published_products")
      .select("slug")
      .eq("status", "active")
      .order("slug")
      .range(from, from + 999);
    if (error) fail("product slugs", error);
    slugs.push(...(data ?? []).map((row) => row.slug));
    if ((data ?? []).length < 1000) return slugs;
  }
}

/**
 * Products worth showing beside this one. The live site calls this "Similar
 * products" and fills it with anything sharing a category, which is how a
 * 1.7m bathtub ends up recommended under a soap dish. Preferring the same
 * product type first is a low bar that it still fails.
 */
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.products);

  const client = publicClient();
  const sameType = await client
    .from("published_products")
    .select("snapshot")
    .eq("status", "active")
    .eq("category_slug", product.categorySlug)
    .eq("type_slug", product.type.slug)
    .neq("slug", product.slug)
    .order("position")
    .limit(limit);
  if (sameType.error) fail("related products", sameType.error);

  const found = (sameType.data ?? []).map((r) => toProduct(r.snapshot as unknown as ProductSnapshot));
  if (found.length >= limit) return found;

  const rest = await client
    .from("published_products")
    .select("snapshot")
    .eq("status", "active")
    .eq("category_slug", product.categorySlug)
    .neq("type_slug", product.type.slug)
    .neq("slug", product.slug)
    .order("position")
    .limit(limit - found.length);
  if (rest.error) fail("related products", rest.error);
  return [...found, ...(rest.data ?? []).map((r) => toProduct(r.snapshot as unknown as ProductSnapshot))];
}

/* ── shelves ────────────────────────────────────────────────────────── */

/** One page of a category shelf, filtered and sorted in the database, with
 *  facet counts for the current selection. See supabase/migrations/…_shelf. */
export async function getShelf(
  categorySlug: string,
  selection: Selection,
  sort: SortKey,
  limit: number,
  offset: number,
): Promise<Shelf> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.products);

  const { data, error } = await publicClient().rpc("shelf", {
    p_category: categorySlug,
    p_types: selection.type,
    p_materials: selection.material,
    p_colours: selection.colour,
    p_sort: sort,
    p_limit: limit,
    p_offset: offset,
  });
  if (error || !data) fail(`shelf ${categorySlug}`, error);
  const shelf = data as unknown as { total: number; products: ProductSnapshot[]; facets: Facets };
  return {
    total: shelf.total,
    products: shelf.products.map(toProduct),
    facets: toFacets(shelf.facets),
  };
}

/* ── collections ────────────────────────────────────────────────────── */

/** The collections on the site, in menu order and then catalogue order:
 *  one category's, or every category's. A collection appears once it has a
 *  product on the site. */
export async function getCollections(categorySlug?: string): Promise<Collection[]> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.collections, tags.categories, tags.products);

  const { data, error } = await publicClient().rpc("collection_cards", { p_category: categorySlug });
  if (error) fail(`collections ${categorySlug ?? "all"}`, error);
  return ((data ?? []) as unknown as CollectionSnapshot[]).map(toCollection);
}

/** One collection and its products on the site, in catalogue order. */
export async function getCollection(
  categorySlug: string,
  slug: string,
): Promise<{ collection: Collection; products: Product[] } | undefined> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.collections, tags.categories, tags.products);

  const { data, error } = await publicClient().rpc("collection_page", { p_category: categorySlug, p_slug: slug });
  if (error) fail(`collection ${categorySlug}/${slug}`, error);
  if (!data) return undefined;
  const page = data as unknown as CollectionSnapshot & { products: ProductSnapshot[] };
  const products = page.products.map(toProduct);
  const cover = page.products.find((p) => p.image)?.image ?? null;
  return { collection: toCollection({ ...page, cover, count: products.length }), products };
}

/* ── categories ─────────────────────────────────────────────────────── */

async function toCategory(s: CategorySnapshot): Promise<Category> {
  // The unfiltered shelf gives a category's counts and facet options.
  const shelf = await getShelf(s.slug, { type: [], material: [], colour: [] }, "default", 0, 0);
  return {
    slug: s.slug,
    name: s.name,
    blurb: s.blurb.length > 0 ? s.blurb : null,
    count: shelf.total,
    totalInCatalogue: shelf.total,
    image: categoryAsset(s.image),
    icon: categoryAsset(s.icon),
    productTypes: shelf.facets.type,
    materials: shelf.facets.material,
    finishes: shelf.facets.colour.map((c) => c.value).sort(),
  };
}

export async function getCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.categories, tags.products);

  const { data, error } = await publicClient()
    .from("published_categories")
    .select("snapshot")
    .eq("status", "active")
    .order("position");
  if (error) fail("categories", error);
  const all = await Promise.all(
    (data ?? []).map((row) => toCategory(row.snapshot as unknown as CategorySnapshot)),
  );
  // A category with nothing live in it is a dead end in the menu.
  return all.filter((c) => c.count > 0);
}

export async function getCategory(slug: string): Promise<Category | undefined> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.categories, tags.products);

  const { data, error } = await publicClient()
    .from("published_categories")
    .select("snapshot")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) fail(`category ${slug}`, error);
  return data ? toCategory(data.snapshot as unknown as CategorySnapshot) : undefined;
}

/* ── finishes ───────────────────────────────────────────────────────── */

/** The finish library, retired finishes included: a published product may
 *  still list one until it is republished, and must not render it blank. */
async function finishLibrary(): Promise<Finish[]> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.finishes);

  const { data, error } = await publicClient()
    .from("published_finishes")
    .select("snapshot, status")
    .order("slug");
  if (error) fail("finishes", error);
  return (data ?? []).map((row) => toFinish(row.snapshot as unknown as FinishSnapshot));
}

/** Active finishes only, for anything that offers a choice. */
export async function getFinishes(): Promise<Finish[]> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.finishes);

  const { data, error } = await publicClient()
    .from("published_finishes")
    .select("snapshot")
    .eq("status", "active")
    .order("slug");
  if (error) fail("finishes", error);
  return (data ?? []).map((row) => toFinish(row.snapshot as unknown as FinishSnapshot));
}

export async function getFinish(slug: string): Promise<Finish | undefined> {
  return (await finishLibrary()).find((f) => f.slug === slug);
}

/** This product's finishes, in the order the client lists them, with any
 *  that no longer resolve quietly dropped rather than rendering blank. */
export async function getFinishesFor(product: Product): Promise<Finish[]> {
  const bySlug = new Map((await finishLibrary()).map((f) => [f.slug, f]));
  return product.finishes.map((slug) => bySlug.get(slug)).filter((f): f is Finish => Boolean(f));
}

/* ── search ─────────────────────────────────────────────────────────── */

/** Matching runs in the database (public.search_collections and
 *  public.search_catalogue), so a visitor never downloads the whole index to
 *  search it. Matching collections come first, then matching products; an
 *  exact item code still puts its product first among the products. */
export async function searchCatalogue(query: string, limit = 40): Promise<SearchResults> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.products, tags.collections);

  const client = publicClient();
  const [collections, products] = await Promise.all([
    client.rpc("search_collections", { p_query: query, p_limit: 8 }),
    client.rpc("search_catalogue", { p_query: query, p_limit: limit }),
  ]);
  if (collections.error) fail("search collections", collections.error);
  if (products.error) fail("search", products.error);
  return {
    collections: (collections.data ?? []) as unknown as SearchResults["collections"],
    products: (products.data ?? []) as unknown as SearchResults["products"],
  };
}

/* ── misc ───────────────────────────────────────────────────────────── */

/** Numbers the site states, counted from what is live: products and
 *  finishes on the site, and categories in the menu. Counted rather than
 *  typed in, so they stay true as the catalogue changes. */
export async function getCatalogueMeta(): Promise<CatalogueMeta> {
  "use cache";
  cacheLife("max");
  cacheTag(tags.meta, tags.products, tags.categories, tags.finishes);

  const client = publicClient();
  const [live, categories, finishes] = await Promise.all([
    client
      .from("published_products")
      .select("published_at", { count: "exact" })
      .eq("status", "active")
      .order("published_at", { ascending: false })
      .limit(1),
    getCategories(),
    client.from("published_finishes").select("slug", { count: "exact", head: true }).eq("status", "active"),
  ]);
  if (live.error) fail("live count", live.error);
  if (finishes.error) fail("finish count", finishes.error);
  const latest = live.data?.[0]?.published_at ?? new Date().toISOString();
  const products = live.count ?? 0;
  return {
    generatedAt: latest.slice(0, 10),
    products,
    productsInCatalogue: products,
    categoriesInCatalogue: categories.length,
    finishesInCatalogue: finishes.count ?? 0,
  };
}
