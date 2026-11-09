"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { publishCategory } from "@/lib/admin/publish";
import { requireStaff } from "@/lib/admin/session";
import { tags } from "@/lib/cache-tags";
import { HOME_HERO_KEY, schemaFor } from "@/lib/site-content/fields";
import type { Json } from "@/lib/supabase/database.types";
import { toPickerProduct, type PickerProduct } from "./picker";

/** A category tile's fields, saved through the category's own version check. */
const tileFields = z
  .object({
    blurb: z.array(z.string().trim().min(1).max(1200)).max(8),
    image: z.string().regex(/^(?!.*\.\.)[A-Za-z0-9/][A-Za-z0-9_./-]*$/).nullable(),
    icon: z.string().regex(/^(?!.*\.\.)[A-Za-z0-9/][A-Za-z0-9_./-]*$/).nullable(),
  })
  .partial();
type TileFields = z.infer<typeof tileFields>;

const changeSet = z.object({
  set: z.record(z.string(), z.unknown()),
  clear: z.array(z.string()).max(200),
  tiles: z.array(z.object({ id: z.uuid(), version: z.int().positive(), fields: tileFields })).max(50),
});
export type ChangeSet = z.infer<typeof changeSet>;

export type SaveResult =
  | {
      ok: true;
      message: string;
      /** The change that puts everything back as it was before this save. */
      undo: ChangeSet;
      /** Each saved tile's new version, for the next save. */
      versions: Record<string, number>;
    }
  | { ok: false; error: string; fields?: Record<string, string>; conflict?: boolean };

/**
 * Saves one page's edits and puts them live: site text and photos in one
 * transaction, then each changed category tile through `save_category`, so
 * a tile edited here and in Categories at the same time is refused rather
 * than overwritten.
 *
 * Returns what everything held before, so the dashboard can offer "Undo this
 * save" by saving that back.
 */
export async function saveSiteContent(input: unknown): Promise<SaveResult> {
  const { supabase } = await requireStaff();
  const parsed = changeSet.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That save isn't valid. Reload the page." };
  const { set, clear, tiles } = parsed.data;

  const fields: Record<string, string> = {};
  const values: Record<string, Json> = {};
  for (const [key, value] of Object.entries(set)) {
    const schema = schemaFor(key);
    if (!schema) return { ok: false, error: `${key} can't be edited here.` };
    const check = schema.safeParse(value);
    if (check.success) values[key] = check.data as Json;
    else fields[key] = check.error.issues[0]?.message ?? "Check this field.";
  }
  if (clear.some((key) => !schemaFor(key))) return { ok: false, error: "That save isn't valid. Reload the page." };
  if (Object.keys(fields).length) return { ok: false, error: "Some fields need attention.", fields };

  // The hero photo comes from a product, so the starred one needs a photo.
  if (typeof values[HOME_HERO_KEY] === "string") {
    const { data: hero } = await supabase.from("admin_products").select("image_path").eq("id", values[HOME_HERO_KEY]).maybeSingle();
    if (!hero?.image_path) return { ok: false, error: "The starred product has no photo, so it can't be the hero.", fields: { [HOME_HERO_KEY]: "Choose a product with a photo." } };
  }

  // Tiles first: they are the part that can be refused for being out of date.
  const versions: Record<string, number> = {};
  const tileUndo: ChangeSet["tiles"] = [];
  for (const tile of tiles) {
    const { data: before } = await supabase.from("categories").select("name, blurb, image, icon").eq("id", tile.id).maybeSingle();
    if (!before) return { ok: false, error: "A category on this page no longer exists. Reload the page." };
    const { data: version, error } = await supabase.rpc("save_category", { p_id: tile.id, p_version: tile.version, p_fields: tile.fields as Json });
    if (error?.code === "PT409") {
      return { ok: false, conflict: true, error: `${before.name} was changed by someone else while you were editing. Reload to see their version.` };
    }
    if (error || version === null) return { ok: false, error: `${before.name} couldn't be saved. Try again.` };
    const live = await publishCategory(supabase, tile.id);
    if (live.error) return { ok: false, error: `${before.name} was saved, but the site couldn't be updated: ${live.error} Save again to retry.` };
    versions[tile.id] = version;
    const previous: TileFields = {};
    if ("blurb" in tile.fields) previous.blurb = before.blurb;
    if ("image" in tile.fields) previous.image = before.image;
    if ("icon" in tile.fields) previous.icon = before.icon;
    tileUndo.push({ id: tile.id, version, fields: previous });
  }

  let previous: Record<string, Json> = {};
  if (Object.keys(values).length || clear.length) {
    const { data, error } = await supabase.rpc("save_site_content", { p_set: values, p_clear: clear });
    if (error) return { ok: false, error: "That couldn't be saved. Try again." };
    previous = (data ?? {}) as Record<string, Json>;
    updateTag(tags.siteContent);
  }

  const undo: ChangeSet = { set: {}, clear: [], tiles: tileUndo };
  for (const [key, value] of Object.entries(previous)) {
    if (value === null) undo.clear.push(key);
    else undo.set[key] = value;
  }
  return { ok: true, message: "Saved. The site shows it now.", undo, versions };
}

/** Visible products matching a name or item code, for the homepage picker. */
export async function findProducts(query: string): Promise<PickerProduct[]> {
  const { supabase } = await requireStaff();
  // Quoted in the filter, with PostgREST's own syntax and wildcards dropped.
  const q = String(query).slice(0, 60).replace(/[%_*\\"(),.]/g, " ").replace(/\s+/g, " ").trim();
  if (q.length < 2) return [];
  const { data } = await supabase
    .from("admin_products")
    .select("id, name, sku, category_name, image_path, status")
    .eq("status", "active")
    .or(`name.ilike."*${q}*",sku.ilike."*${q}*"`)
    .order("name")
    .limit(12);
  return (data ?? []).map(toPickerProduct);
}
