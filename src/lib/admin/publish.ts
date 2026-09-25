import "server-only";
import { updateTag } from "next/cache";
import { tags } from "@/lib/cache-tags";
import type { serverClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof serverClient>>;

const CHUNK = 100;
const PARALLEL = 6;

/**
 * Publishes products and refreshes exactly the pages that show them.
 *
 * Each product goes through `public.publish_product`, one transaction per
 * product, as the signed-in staff member. Then the cache: every list of
 * products is refreshed once however many were published, and each product's
 * own page is refreshed under both its old slug and its new one, so a renamed
 * product's old address starts redirecting straight away.
 *
 * `updateTag` makes the next request wait for fresh data rather than serving
 * the old page, so the person who pressed Publish sees their change at once.
 * It only works inside a Server Action, which is where this is called from.
 */
export async function publishProducts(
  supabase: Client,
  ids: string[],
  note?: string,
): Promise<{ published: number; failed: Array<{ id: string; message: string }> }> {
  const slugsBefore = await publishedSlugs(supabase, ids);

  let published = 0;
  const failed: Array<{ id: string; message: string }> = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, ids.length) }, async () => {
      while (next < ids.length) {
        const id = ids[next++]!;
        const { error } = await supabase.rpc("publish_product", { p_id: id, p_note: note });
        if (error) failed.push({ id, message: error.message });
        else published += 1;
      }
    }),
  );

  const slugsAfter = await publishedSlugs(supabase, ids);
  if (published > 0) {
    updateTag(tags.products);
    for (const slug of new Set([...slugsBefore, ...slugsAfter])) updateTag(tags.product(slug));
  }
  return { published, failed };
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
