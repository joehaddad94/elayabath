"use server";

import { z } from "zod";
import { toGridRow, type GridRow } from "@/lib/admin/grid-row";
import { ADMIN_PRODUCT_COLUMNS } from "@/lib/admin/product-query";
import { productFields } from "@/lib/admin/product-schema";
import { syncProducts } from "@/lib/admin/publish";
import { requireStaff } from "@/lib/admin/session";
import type { TablesUpdate } from "@/lib/supabase/database.types";

type ProductPatch = TablesUpdate<"products">;

/* ── inline edits ─────────────────────────────────────────────────────── */

/** The fields the grid may edit directly. Everything with structure (the
 *  gallery, finishes, the description) is edited in the product editor. */
const edit = z.discriminatedUnion("field", [
  z.object({ field: z.literal("name"), value: productFields.name }),
  z.object({ field: z.literal("dimensions"), value: productFields.dimensions }),
  z.object({ field: z.literal("status"), value: z.enum(["active", "draft"]) }),
  z.object({ field: z.literal("category_id"), value: productFields.category_id }),
  z.object({ field: z.literal("type_id"), value: productFields.type_id }),
]);

export type EditResult =
  | { ok: true; row: GridRow }
  | { ok: false; error: string; row?: GridRow; conflict?: { by: string | null; at: string } };

/**
 * Saves one cell, if nobody else has saved the product since it was loaded,
 * and puts the change live.
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

  // Through the same save as the product editor: version-checked, and a
  // change back to the live value leaves nothing to publish.
  const { error } = await supabase.rpc("save_product", {
    p_id: input.id,
    p_version: input.version,
    p_fields: patch as never,
  });

  // Saved; the site follows.
  const synced = error ? null : await syncProducts(supabase, [input.id]);

  const fresh = await supabase.from("admin_products").select(ADMIN_PRODUCT_COLUMNS).eq("id", input.id).maybeSingle();
  const row = fresh.data ? toGridRow(fresh.data as unknown as Record<string, unknown>) : undefined;

  if (error && error.code !== "PT409") return { ok: false, error: "That change couldn't be saved. Try again.", row };
  if (error) {
    return {
      ok: false,
      error: row
        ? `${row.updated_by ?? "Someone"} changed this product since you opened it. Their version is now shown.`
        : "This product no longer exists.",
      row,
      conflict: row ? { by: row.updated_by, at: row.updated_at } : undefined,
    };
  }
  if (!row) return { ok: false, error: "This product no longer exists." };
  if (synced?.failed.length) return { ok: false, error: `Saved, but the site couldn't be updated: ${synced.failed[0]!.message}`, row };
  return { ok: true, row };
}

/* ── bulk actions ─────────────────────────────────────────────────────── */

const bulkInput = z.object({
  action: z.enum(["show", "hide", "category"]),
  categoryId: z.uuid().optional(),
  // The ticked rows.
  ids: z.array(z.uuid()).min(1).max(5000),
});

export type BulkResult = { ok: true; count: number; message: string } | { ok: false; error: string };

/** One change to the ticked rows, put live at once like any other save. */
export async function bulkUpdate(input: z.input<typeof bulkInput>): Promise<BulkResult> {
  const { supabase } = await requireStaff();
  const parsed = bulkInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Tick the products to act on first." };
  const { action, categoryId, ids } = parsed.data;
  if (action === "category" && !categoryId) return { ok: false, error: "Choose a category." };

  const patch: ProductPatch =
    action === "show" ? { status: "active" }
    : action === "hide" ? { status: "draft" }
    : { category_id: categoryId, type_id: null };

  const changed: string[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    let query = supabase.from("products").update(patch).in("id", ids.slice(i, i + 200));
    // Products already in the category keep their type.
    if (action === "category") query = query.neq("category_id", categoryId!);
    const { data, error } = await query.select("id");
    if (error) return { ok: false, error: `Stopped after ${changed.length}: ${error.message}` };
    changed.push(...(data ?? []).map((r) => r.id));
  }

  const { failed } = await syncProducts(supabase, changed);
  if (failed.length) {
    return { ok: false, error: `${changed.length - failed.length} updated on the site; ${failed.length} failed: ${failed[0]!.message}` };
  }
  return { ok: true, count: changed.length, message: `${changed.length} changed. The site shows the change now.` };
}
