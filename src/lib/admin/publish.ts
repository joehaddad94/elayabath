import "server-only";
import { updateTag } from "next/cache";
import { tags } from "@/lib/cache-tags";
import type { serverClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof serverClient>>;

const CHUNK = 100;
const PARALLEL = 6;

/**
 * Makes the site match the saved products, and refreshes exactly the pages
 * that show them. Called straight after every save: saving is what puts a
 * change live.
 *
 * Each product goes through `public.sync_product`, one transaction per
 * product, as the signed-in staff member: a visible product is published, a
 * hidden one taken off the site. Then the cache: every list of products is
 * refreshed once however many changed, and each product's own page is
 * refreshed under both its old slug and its new one, so a renamed product's
 * old address starts redirecting straight away and a hidden one's page goes.
 *
 * `updateTag` makes the next request wait for fresh data rather than serving
 * the old page, so the person who saved sees their change at once. It only
 * works inside a Server Action, which is where this is called from.
 */
export async function syncProducts(
  supabase: Client,
  ids: string[],
  note?: string,
): Promise<{ synced: number; failed: Array<{ id: string; message: string }> }> {
  const slugsBefore = await publishedSlugs(supabase, ids);

  // A finish goes live with the first product that uses it.
  const newFinishes = await unpublishedFinishes(supabase, ids);
  for (const id of newFinishes) {
    await supabase.rpc("publish_finish", { p_id: id, p_note: "Published with a product that uses it" });
  }
  if (newFinishes.length) updateTag(tags.finishes);

  let synced = 0;
  const failed: Array<{ id: string; message: string }> = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, ids.length) }, async () => {
      while (next < ids.length) {
        const id = ids[next++]!;
        const { error } = await supabase.rpc("sync_product", { p_id: id, p_note: note });
        if (error) failed.push({ id, message: error.message });
        else synced += 1;
      }
    }),
  );

  const slugsAfter = await publishedSlugs(supabase, ids);
  if (synced > 0) {
    updateTag(tags.products);
    for (const slug of new Set([...slugsBefore, ...slugsAfter])) updateTag(tags.product(slug));
  }
  return { synced, failed };
}

async function unpublishedFinishes(supabase: Client, productIds: string[]): Promise<string[]> {
  const linked = new Set<string>();
  for (let i = 0; i < productIds.length; i += CHUNK) {
    const { data } = await supabase.from("product_finishes").select("finish_id").in("product_id", productIds.slice(i, i + CHUNK));
    for (const row of data ?? []) linked.add(row.finish_id);
  }
  const ids = [...linked];
  const pending: string[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await supabase.from("finishes").select("id").in("id", ids.slice(i, i + CHUNK)).is("published_version", null);
    pending.push(...(data ?? []).map((f) => f.id));
  }
  return pending;
}

/**
 * Puts a saved category live (visible or hidden), and refreshes every page that shows its name or its
 * product types' names: the menus and shelves, and each of its products'
 * own pages (a product page carries its category and type names).
 */
export async function publishCategory(supabase: Client, id: string, note?: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc("publish_category", { p_id: id, p_note: note });
  if (error) return { error: error.message };
  const { data: category } = await supabase.from("categories").select("slug").eq("id", id).single();
  const { data: live } = await supabase.from("published_products").select("slug").eq("category_slug", category?.slug ?? "");
  updateTag(tags.categories);
  updateTag(tags.products);
  for (const p of live ?? []) updateTag(tags.product(p.slug));
  return {};
}

/** Puts a saved finish live. Every page that names finishes reads the finish
 *  library under one tag, and the shelves' colour filters under another. */
export async function publishFinish(supabase: Client, id: string, note?: string): Promise<{ error?: string }> {
  const { error } = await supabase.rpc("publish_finish", { p_id: id, p_note: note });
  if (error) return { error: error.message };
  updateTag(tags.finishes);
  updateTag(tags.products);
  return {};
}

/** Order is layout: it goes live as soon as it is saved, without touching
 *  any product's or category's own version. */
export async function publishOrder(
  supabase: Client,
  order: { kind: "products"; categoryId: string; ids: string[] } | { kind: "categories"; ids: string[] } | { kind: "featured"; ids: string[] },
): Promise<{ error?: string }> {
  const { error } =
    order.kind === "products"
      ? await supabase.rpc("set_product_order", { p_category: order.categoryId, p_ids: order.ids })
      : order.kind === "categories"
        ? await supabase.rpc("set_category_order", { p_ids: order.ids })
        : await supabase.rpc("set_featured_order", { p_ids: order.ids });
  if (error) return { error: error.message };
  updateTag(order.kind === "categories" ? tags.categories : tags.products);
  return {};
}

async function publishedSlugs(supabase: Client, ids: string[]): Promise<string[]> {
  const slugs: string[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data } = await supabase
      .from("published_products")
      .select("slug")
      .in("product_id", ids.slice(i, i + CHUNK));
    slugs.push(...(data ?? []).map((r) => r.slug));
  }
  return slugs;
}
