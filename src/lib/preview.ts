import "server-only";
import { productFromSnapshot } from "./catalogue";
import { serverClient } from "./supabase/server";
import type { Product } from "./types";

/**
 * The saved draft of a product, for a staff member previewing it.
 *
 * Only called while draft mode is on, which only the staff-only
 * /admin/preview route turns on. Even then the draft is read as the
 * signed-in staff member, under row-level security: a preview cookie on its
 * own, without a staff session, shows nothing but the live page.
 *
 * Built by the same `public.product_snapshot` that publishing uses, so the
 * preview is exactly what Publish would put live.
 */
export async function getPreviewProduct(slug: string): Promise<{ id: string; product: Product } | undefined> {
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return undefined;

  const { data: row } = await supabase.from("products").select("id").eq("slug", slug).maybeSingle();
  if (!row) return undefined;
  const { data: snapshot } = await supabase.rpc("product_snapshot", { p_id: row.id });
  return snapshot ? { id: row.id, product: productFromSnapshot(snapshot) } : undefined;
}
