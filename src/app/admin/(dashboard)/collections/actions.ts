"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { collectionFolder, collectionForm, slugify } from "@/lib/admin/catalogue-schema";
import { refreshCollections, syncProducts } from "@/lib/admin/publish";
import { requireStaff } from "@/lib/admin/session";

export type CollectionSaveResult = { ok: true; message: string } | { ok: false; error: string; fields?: Record<string, string> };

/**
 * Saves a collection's name, address, description and photo. Collections
 * have no draft: the save is live, on every page that shows the collection.
 *
 * A changed address changes the collection page's address; there is no
 * redirect from the old one, so the editor says so before it is changed.
 */
export async function saveCollection(input: { id: string; form: unknown }): Promise<CollectionSaveResult> {
  const { supabase } = await requireStaff();
  const id = z.uuid().safeParse(input.id);
  if (!id.success) return { ok: false, error: "That save isn't valid. Reload the page." };
  const parsed = collectionForm.safeParse(input.form);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Some fields need attention.", fields };
  }
  const form = parsed.data;

  const { data: current } = await supabase.from("collections").select("image_path").eq("id", id.data).maybeSingle();
  if (!current) return { ok: false, error: "This collection no longer exists." };
  // A new photo must be an upload into this collection's own folder.
  if (form.image_path && form.image_path !== current.image_path && !form.image_path.startsWith(collectionFolder(id.data))) {
    return { ok: false, error: "The photo didn't come from this collection's uploads. Upload it again." };
  }

  const { error } = await supabase.from("collections").update(form).eq("id", id.data);
  if (error?.code === "23505") {
    return { ok: false, error: "Some fields need attention.", fields: { slug: "Another collection in this category already uses this address." } };
  }
  if (error) return { ok: false, error: "That couldn't be saved. Try again." };
  refreshCollections();
  return { ok: true, message: "Saved. The site shows it now." };
}

export type NewCollectionState = {
  error?: string;
  values?: { name: string; category_id: string };
  attempt?: number;
};

/** A new collection, named and placed in a category. It is on the site once
 *  a visible product is in it. */
export async function createCollection(previous: NewCollectionState, formData: FormData): Promise<NewCollectionState> {
  const refused = (state: Omit<NewCollectionState, "attempt">): NewCollectionState => ({ ...state, attempt: (previous.attempt ?? 0) + 1 });
  const { supabase } = await requireStaff();
  const values = { name: String(formData.get("name") ?? "").trim(), category_id: String(formData.get("category_id") ?? "") };
  const name = collectionForm.shape.name.safeParse(values.name);
  if (!name.success) return refused({ error: name.error.issues[0]?.message, values });
  if (!z.uuid().safeParse(values.category_id).success) return refused({ error: "Choose a category.", values });
  const slug = slugify(name.data);
  if (!slug) return refused({ error: "The name needs a letter or digit.", values });

  const { data, error } = await supabase
    .from("collections")
    .insert({ name: name.data, slug, category_id: values.category_id })
    .select("id")
    .single();
  if (error?.code === "23505") return refused({ error: "This category already has a collection with that name.", values });
  if (error) return refused({ error: "It couldn't be created. Try again.", values });
  redirect(`/admin/collections/${data.id}`);
}

/** Deletes a collection with no products in it. One with products can't be:
 *  move them to another collection first. */
export async function deleteCollection(input: { id: string }): Promise<{ ok: false; error: string }> {
  const { supabase } = await requireStaff();
  const id = z.uuid().safeParse(input.id);
  if (!id.success) return { ok: false, error: "That collection isn't valid." };
  const { count } = await supabase.from("products").select("id", { count: "exact", head: true }).eq("collection_id", id.data);
  if ((count ?? 0) > 0) return { ok: false, error: "It still has products. Move them to another collection first." };
  const { error } = await supabase.from("collections").delete().eq("id", id.data);
  if (error) return { ok: false, error: "It couldn't be deleted. Try again." };
  refreshCollections();
  redirect("/admin/collections");
}

/**
 * Puts every product without a collection (new products from an import, or
 * ones moved to another category) into the collection named after it in its
 * category, making that collection if there is none, and puts the result
 * live: visible products appear on the site.
 */
export async function groupProducts(): Promise<{ ok: boolean; message: string }> {
  const { supabase } = await requireStaff();
  const { data: loose } = await supabase.from("products").select("id").is("collection_id", null);
  const ids = (loose ?? []).map((p) => p.id);
  if (ids.length === 0) return { ok: true, message: "Every product is already in a collection." };

  const { error } = await supabase.rpc("group_into_collections");
  if (error) return { ok: false, message: `They couldn't be grouped: ${error.message}` };
  const { failed } = await syncProducts(supabase, ids, "Put in a collection by name");
  refreshCollections();
  const n = `${ids.length} product${ids.length === 1 ? "" : "s"}`;
  return failed.length
    ? { ok: false, message: `${n} grouped, but ${failed.length} couldn't be updated on the site: ${failed[0]!.message}` }
    : { ok: true, message: `${n} put in collections by name.` };
}
