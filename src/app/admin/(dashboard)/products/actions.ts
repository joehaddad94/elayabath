"use server";

import { z } from "zod";
import { LIST_COLUMNS, toProductRow, type ProductRow } from "@/lib/admin/grid-row";
import { syncProducts } from "@/lib/admin/publish";
import { requireStaff } from "@/lib/admin/session";
import { storageUrl } from "@/lib/supabase/config";

type Client = Awaited<ReturnType<typeof requireStaff>>["supabase"];

/** The list rows of these products, as they are now. */
async function freshRows(supabase: Client, ids: string[]): Promise<ProductRow[]> {
  const rows: ProductRow[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase.from("admin_products").select(LIST_COLUMNS).in("id", ids.slice(i, i + 200));
    rows.push(...(data ?? []).map((r) => toProductRow(r as unknown as Record<string, unknown>)));
  }
  return rows;
}

/* ── one product's switch ─────────────────────────────────────────────── */

export type StatusResult = { ok: true; row: ProductRow } | { ok: false; error: string; row?: ProductRow };

/**
 * Shows or hides one product, if nobody has saved it since the list was
 * loaded, and puts the change live. The list's only edit in place: every
 * other field is changed in the product editor.
 *
 * On a conflict nothing is written; the list is handed the current row and
 * says who changed it, so the person decides again with the product as it
 * is now.
 */
export async function setProductStatus(input: { id: string; version: number; status: string }): Promise<StatusResult> {
  const { supabase } = await requireStaff();
  const parsed = z
    .object({ id: z.uuid(), version: z.int().positive(), status: z.enum(["active", "draft"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: "That change isn't valid. Reload the page." };
  const { id, version, status } = parsed.data;

  const { error } = await supabase.rpc("save_product", { p_id: id, p_version: version, p_fields: { status } as never });
  const synced = error ? null : await syncProducts(supabase, [id]);
  const [row] = await freshRows(supabase, [id]);

  if (!row) return { ok: false, error: "This product no longer exists." };
  if (error?.code === "PT409") {
    const { data } = await supabase.from("products").select("updated_by").eq("id", id).maybeSingle();
    return { ok: false, error: `${data?.updated_by ?? "Someone"} changed “${row.name}” since the list loaded. It now shows their version.`, row };
  }
  if (error) return { ok: false, error: "That change couldn't be saved. Try again.", row };
  if (synced?.failed.length) return { ok: false, error: `Saved, but the site couldn't be updated: ${synced.failed[0]!.message}`, row };
  return { ok: true, row };
}

/* ── bulk actions ─────────────────────────────────────────────────────── */

const bulkInput = z.object({
  action: z.enum(["show", "hide", "collection"]),
  collectionId: z.uuid().optional(),
  // The ticked rows.
  ids: z.array(z.uuid()).min(1).max(5000),
});

export type BulkResult =
  | { ok: true; count: number; message: string; rows: ProductRow[] }
  | { ok: false; error: string; rows?: ProductRow[] };

/** One change to the ticked rows, put live at once like any other save.
 *  Returns the changed rows as they are now, so the list updates in place. */
export async function bulkUpdate(input: z.input<typeof bulkInput>): Promise<BulkResult> {
  const { supabase } = await requireStaff();
  const parsed = bulkInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Tick the products to act on first." };
  const { action, collectionId, ids } = parsed.data;

  let target: { id: string; category_id: string } | null = null;
  if (action === "collection") {
    if (!collectionId) return { ok: false, error: "Choose a collection." };
    const { data } = await supabase.from("collections").select("id, category_id").eq("id", collectionId).maybeSingle();
    if (!data) return { ok: false, error: "That collection no longer exists. Reload the page." };
    target = data;
  }

  const changed: string[] = [];
  let moved = 0;
  // Each update, a slice at a time, touching only rows it changes, so
  // "changed" and the undo are exact.
  const run = async (changesCategory: boolean, narrow: (ids: string[]) => PromiseLike<{ data: Array<{ id: string }> | null; error: { message: string } | null }>) => {
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await narrow(ids.slice(i, i + 200));
      if (error) return error.message;
      changed.push(...(data ?? []).map((r) => r.id));
      if (changesCategory) moved += (data ?? []).length;
    }
    return null;
  };

  let failure: string | null = null;
  if (action !== "collection") {
    const status = action === "show" ? "active" : "draft";
    failure = await run(false, (slice) =>
      supabase.from("products").update({ status }).in("id", slice).neq("status", status).select("id"),
    );
  } else {
    const t = target!;
    const notThere = `collection_id.is.null,collection_id.neq.${t.id}`;
    // Already in the collection's category: only the collection changes.
    failure = await run(false, (slice) =>
      supabase.from("products").update({ collection_id: t.id }).in("id", slice).eq("category_id", t.category_id).or(notThere).select("id"),
    );
    // From another category: the category follows, and the type goes, since
    // a type belongs to one category.
    failure ??= await run(true, (slice) =>
      supabase
        .from("products")
        .update({ collection_id: t.id, category_id: t.category_id, type_id: null })
        .in("id", slice)
        .neq("category_id", t.category_id)
        .select("id"),
    );
  }
  if (failure) return { ok: false, error: `Stopped after ${changed.length}: ${failure}`, rows: await freshRows(supabase, changed) };

  const { failed } = await syncProducts(supabase, changed);
  const rows = await freshRows(supabase, changed);
  if (failed.length) {
    return { ok: false, error: `${changed.length - failed.length} updated on the site; ${failed.length} failed: ${failed[0]!.message}`, rows };
  }
  const n = `${changed.length} product${changed.length === 1 ? "" : "s"}`;
  const message =
    action === "show" ? `${n} now on the site.`
    : action === "hide" ? `${n} taken off the site.`
    : `${n} moved.${moved > 0 ? ` ${moved} changed category, so their type was cleared.` : ""}`;
  return { ok: true, count: changed.length, message, rows };
}

const restoreInput = z
  .array(z.object({ id: z.uuid(), category_id: z.uuid(), collection_id: z.uuid().nullable(), type_id: z.uuid().nullable() }))
  .min(1)
  .max(5000);

/** Undoes a bulk move: each product goes back to the collection, category
 *  and type it had, and the site follows. */
export async function restorePlaces(input: z.input<typeof restoreInput>): Promise<BulkResult> {
  const { supabase } = await requireStaff();
  const parsed = restoreInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That undo isn't valid. Reload the page." };

  // One update per place, rather than one per product.
  const groups = new Map<string, string[]>();
  for (const e of parsed.data) {
    const key = `${e.category_id}|${e.collection_id ?? ""}|${e.type_id ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), e.id]);
  }
  const changed: string[] = [];
  for (const [key, ids] of groups) {
    const [category_id, collection_id, type_id] = key.split("|");
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await supabase
        .from("products")
        .update({ category_id, collection_id: collection_id || null, type_id: type_id || null })
        .in("id", ids.slice(i, i + 200))
        .select("id");
      if (error) return { ok: false, error: `Stopped after ${changed.length}: ${error.message}`, rows: await freshRows(supabase, changed) };
      changed.push(...(data ?? []).map((r) => r.id));
    }
  }
  const { failed } = await syncProducts(supabase, changed);
  const rows = await freshRows(supabase, changed);
  if (failed.length) return { ok: false, error: `Moved back, but ${failed.length} couldn't be updated on the site: ${failed[0]!.message}`, rows };
  return { ok: true, count: changed.length, message: `${changed.length} moved back.`, rows };
}

/* ── photos ───────────────────────────────────────────────────────────── */

export interface Photo {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

/** One product's gallery, in its order, for the photo viewer on the list.
 *  Read when the viewer opens rather than with every row, so scrolling the
 *  grid stays one query per block. */
export async function productPhotos(id: string): Promise<Photo[]> {
  const { supabase } = await requireStaff();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return [];
  const { data, error } = await supabase
    .from("product_images")
    .select("path, alt, width, height")
    .eq("product_id", id)
    .order("position")
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((i) => ({ url: storageUrl("product-media", i.path), alt: i.alt, width: i.width, height: i.height }));
}
