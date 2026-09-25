"use server";

import { z } from "zod";
import { toGridRow, type GridRow } from "@/lib/admin/grid-row";
import { ADMIN_PRODUCT_COLUMNS, gridStateSchema, matchingIds } from "@/lib/admin/product-query";
import { publishProducts } from "@/lib/admin/publish";
import { requireStaff } from "@/lib/admin/session";
import type { TablesUpdate } from "@/lib/supabase/database.types";

type ProductPatch = TablesUpdate<"products">;

/* ── inline edits ─────────────────────────────────────────────────────── */

/** The fields the grid may edit directly. Everything with structure (the
 *  gallery, finishes, the description) is edited in the product editor. */
const edit = z.discriminatedUnion("field", [
  z.object({ field: z.literal("name"), value: z.string().trim().min(1, "A name is required.").max(200) }),
  z.object({
    field: z.literal("dimensions"),
    value: z.string().trim().max(200).transform((v) => (v === "" ? null : v)).nullable(),
  }),
  z.object({ field: z.literal("featured"), value: z.boolean() }),
  z.object({ field: z.literal("status"), value: z.enum(["active", "discontinued"]) }),
  z.object({ field: z.literal("category_id"), value: z.uuid() }),
  z.object({ field: z.literal("type_id"), value: z.uuid().nullable() }),
]);

export type EditResult =
  | { ok: true; row: GridRow }
  | { ok: false; error: string; row?: GridRow; conflict?: { by: string | null; at: string } };

/**
 * Saves one cell, as a draft, if nobody else has saved the product since it
 * was loaded.
 *
 * The version check is the conflict guard: two people with equal rights will
 * sometimes open the same product, and the second save must not silently
 * overwrite the first. On a conflict the grid is handed the current row and
 * who saved it, and puts that on screen instead of the stale value.
 */
export async function updateProductField(input: {
  id: string;
  version: number;
  field: string;
  value: unknown;
}): Promise<EditResult> {
  const { supabase } = await requireStaff();
  const parsed = edit.safeParse({ field: input.field, value: input.value });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That value isn't allowed." };

  const patch = { [parsed.data.field]: parsed.data.value } as ProductPatch;

  // Moving a product to another category keeps its type only if that type
  // exists in the new category.
  if (parsed.data.field === "category_id") {
    const { data: current } = await supabase.from("products").select("type_id").eq("id", input.id).maybeSingle();
    if (current?.type_id) {
      const { data: fits } = await supabase
        .from("product_types")
        .select("id")
        .eq("id", current.type_id)
        .eq("category_id", parsed.data.value)
        .maybeSingle();
      if (!fits) patch.type_id = null;
    }
  }

  const { data: saved, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", input.id)
    .eq("version", input.version)
    .select("id")
    .maybeSingle();

  const fresh = await supabase.from("admin_products").select(ADMIN_PRODUCT_COLUMNS).eq("id", input.id).maybeSingle();
  const row = fresh.data ? toGridRow(fresh.data as unknown as Record<string, unknown>) : undefined;

  if (error) return { ok: false, error: "That change couldn't be saved. Try again.", row };
  if (!saved) {
    return {
      ok: false,
      error: row
        ? `${row.updated_by ?? "Someone"} changed this product since you opened it. Their version is now shown.`
        : "This product no longer exists.",
      row,
      conflict: row ? { by: row.updated_by, at: row.updated_at } : undefined,
    };
  }
  return row ? { ok: true, row } : { ok: false, error: "This product no longer exists." };
}

/* ── bulk actions ─────────────────────────────────────────────────────── */

const bulkInput = z.object({
  action: z.enum(["publish", "discontinue", "activate", "feature", "unfeature", "category"]),
  categoryId: z.uuid().optional(),
  // Either the ticked rows, or everything matching the grid's filter. The
  // Infinite Row Model cannot select rows it has not loaded, and a list of
  // 20,000 ids is the wrong thing to send anyway, so "all matching" travels
  // as the filter itself and is resolved here, by the same query the grid
  // pages with.
  ids: z.array(z.uuid()).max(5000).optional(),
  state: gridStateSchema.optional(),
});

export type BulkResult = { ok: true; count: number; message: string } | { ok: false; error: string };

export async function bulkUpdate(input: z.input<typeof bulkInput>): Promise<BulkResult> {
  const { supabase } = await requireStaff();
  const parsed = bulkInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That bulk action isn't valid." };
  const { action, categoryId } = parsed.data;

  const ids = parsed.data.state ? await matchingIds(supabase, parsed.data.state) : (parsed.data.ids ?? []);
  if (ids.length === 0) return { ok: false, error: "Nothing is selected." };

  if (action === "publish") {
    const { published, failed } = await publishProducts(supabase, ids, "Bulk publish from the grid");
    return failed.length
      ? { ok: false, error: `${published} published; ${failed.length} failed: ${failed[0]!.message}` }
      : { ok: true, count: published, message: `${published} published. The site shows them now.` };
  }

  const patch: ProductPatch =
    action === "discontinue" ? { status: "discontinued" }
    : action === "activate" ? { status: "active" }
    : action === "feature" ? { featured: true }
    : action === "unfeature" ? { featured: false }
    : { category_id: categoryId, type_id: null };
  if (action === "category" && !categoryId) return { ok: false, error: "Choose a category." };

  let count = 0;
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase.from("products").update(patch).in("id", ids.slice(i, i + 200)).select("id");
    if (error) return { ok: false, error: `Stopped after ${count}: ${error.message}` };
    count += data?.length ?? 0;
  }
  return {
    ok: true,
    count,
    message: `${count} changed, as drafts. Publish them to put the change on the site.`,
  };
}

/* ── saved views ──────────────────────────────────────────────────────── */

const viewInput = z.object({
  name: z.string().trim().min(1, "Give the view a name.").max(60),
  shared: z.boolean(),
  columnState: z.array(z.record(z.string(), z.unknown())).max(60),
  state: gridStateSchema,
});

export async function saveView(input: z.input<typeof viewInput>): Promise<{ ok: boolean; error?: string; id?: string }> {
  const { supabase, email } = await requireStaff();
  const parsed = viewInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const { data, error } = await supabase
    .from("grid_views")
    .upsert(
      {
        owner: email,
        name: parsed.data.name,
        shared: parsed.data.shared,
        column_state: parsed.data.columnState as never,
        filter_model: parsed.data.state as never,
        sort_model: parsed.data.state.sort as never,
      },
      { onConflict: "owner,name" },
    )
    .select("id")
    .single();
  if (error) return { ok: false, error: "The view couldn't be saved." };
  return { ok: true, id: data.id };
}

export async function deleteView(id: string): Promise<{ ok: boolean }> {
  const { supabase } = await requireStaff();
  const { error } = await supabase.from("grid_views").delete().eq("id", id);
  return { ok: !error };
}
