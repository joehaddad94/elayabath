"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { describeWriteError, productFields, productForm, slugFromSku } from "@/lib/admin/product-schema";
import { uploadFolder } from "@/lib/admin/media";
import { syncProducts } from "@/lib/admin/publish";
import { requireStaff } from "@/lib/admin/session";

export type SaveResult =
  | { ok: true; version: number; updatedAt: string; live: { slug: string } | null; message: string }
  | { ok: false; error: string; fields?: Record<string, string> }
  | { ok: false; conflict: { by: string | null; at: string; version: number }; error: string };

/**
 * Saves the whole editor and puts it live: fields and finishes together,
 * through `public.save_product`, so a save is all or nothing; then the site
 * is made to match, showing the product or, if it is hidden, taking it off.
 *
 * `version` is the one the editor loaded. If someone saved since, nothing is
 * written and the editor is told who and when; it then offers to reload
 * theirs or to overwrite, and overwriting sends their version back here as
 * the one being replaced. So an overwrite is a deliberate choice about a
 * version the editor has been shown, never a blind write.
 */
export async function saveProduct(input: { id: string; version: number; form: unknown }): Promise<SaveResult> {
  const { supabase } = await requireStaff();
  const id = z.uuid().safeParse(input.id);
  const version = z.int().positive().safeParse(input.version);
  if (!id.success || !version.success) return { ok: false, error: "That save isn't valid. Reload the page." };

  const parsed = productForm.safeParse(input.form);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Some fields need attention.", fields };
  }
  const { finishes, images, ...fields } = parsed.data;

  const [{ data: current }, { data: stored }] = await Promise.all([
    supabase.from("products").select("datasheet_path").eq("id", id.data).maybeSingle(),
    supabase.from("product_images").select("path").eq("product_id", id.data),
  ]);
  if (!current) return { ok: false, error: "This product no longer exists." };

  // Files the product already has are fine; a new one must be an upload into
  // this product's own folder, so a save can't claim some other file.
  const folder = uploadFolder(id.data);
  const known = new Set((stored ?? []).map((i) => i.path));
  if (images.some((i) => !known.has(i.path) && !i.path.startsWith(folder))) {
    return { ok: false, error: "A photograph didn't come from this product's uploads. Remove it and upload it again." };
  }
  if (fields.datasheet_path && fields.datasheet_path !== current.datasheet_path && !fields.datasheet_path.startsWith(folder)) {
    return { ok: false, error: "The data sheet didn't come from this product's uploads. Upload it again." };
  }

  // A type belongs to one category, so it must match the category chosen.
  if (fields.type_id) {
    const { data: fits } = await supabase
      .from("product_types")
      .select("id")
      .eq("id", fields.type_id)
      .eq("category_id", fields.category_id)
      .maybeSingle();
    if (!fits) return { ok: false, error: "Some fields need attention.", fields: { type_id: "That type isn't in this category." } };
  }

  // An address another product used to have still redirects to it. Taking
  // it would break that product's old links.
  const { data: claimed } = await supabase
    .from("redirects")
    .select("product_id")
    .eq("from_slug", fields.slug)
    .neq("product_id", id.data)
    .maybeSingle();
  if (claimed) {
    return { ok: false, error: "Some fields need attention.", fields: { slug: "This address still redirects to another product." } };
  }

  const { data: saved, error } = await supabase.rpc("save_product", {
    p_id: id.data,
    p_version: version.data,
    p_fields: fields,
    p_finishes: finishes,
    p_images: images,
  });

  if (error?.code === "PT409") {
    const { data: theirs } = await supabase
      .from("products")
      .select("version, updated_by, updated_at")
      .eq("id", id.data)
      .maybeSingle();
    if (!theirs) return { ok: false, error: "This product no longer exists." };
    return {
      ok: false,
      error: `${theirs.updated_by ?? "Someone"} saved this product while you were editing it.`,
      conflict: { by: theirs.updated_by, at: theirs.updated_at, version: theirs.version },
    };
  }
  if (error || saved === null) {
    const message = describeWriteError(error ?? { message: "" });
    const field = error?.message.includes("sku") ? "sku" : error?.message.includes("slug") ? "slug" : null;
    return { ok: false, error: message, fields: field && error?.code === "23505" ? { [field]: message } : undefined };
  }

  // Saved; now the site follows. A failure here leaves the save in place and
  // says so: saving again retries.
  const { failed } = await syncProducts(supabase, [id.data]);
  const [{ data: row }, { data: live }] = await Promise.all([
    supabase.from("products").select("updated_at, status").eq("id", id.data).single(),
    supabase.from("published_products").select("slug").eq("product_id", id.data).maybeSingle(),
  ]);
  if (failed.length) {
    return { ok: false, error: `Saved, but the site couldn't be updated: ${failed[0]!.message} Save again to retry.` };
  }
  return {
    ok: true,
    version: saved,
    updatedAt: row?.updated_at ?? new Date().toISOString(),
    live,
    message: row?.status === "draft" ? "Saved. It is hidden, so the site doesn't show it." : "Saved. The site shows it now.",
  };
}

export type CreateState = {
  error?: string;
  fields?: Record<string, string>;
  /** What was typed, so a refused form comes back filled in. */
  values?: { sku: string; name: string; category_id: string };
  /** Counts refusals, so the form can be rebuilt with what was typed. */
  attempt?: number;
};

const createInput = z.object({
  sku: productFields.sku,
  name: productFields.name,
  category_id: productFields.category_id,
});

/** A new product starts hidden, with just enough to be found: its item
 *  code, its name and its category. Everything else is filled in the
 *  editor, and it goes on the site when it is made visible there. */
export async function createProduct(previous: CreateState, formData: FormData): Promise<CreateState> {
  const refused = (state: Omit<CreateState, "attempt">): CreateState => ({ ...state, attempt: (previous.attempt ?? 0) + 1 });
  const { supabase } = await requireStaff();
  const values = {
    sku: String(formData.get("sku") ?? ""),
    name: String(formData.get("name") ?? ""),
    category_id: String(formData.get("category_id") ?? ""),
  };
  const parsed = createInput.safeParse(values);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return refused({ error: "Some fields need attention.", fields, values });
  }

  const { data: existing } = await supabase.from("products").select("id").eq("sku", parsed.data.sku).maybeSingle();
  if (existing) return refused({ error: "Some fields need attention.", fields: { sku: "Another product already has this item code." }, values });

  const slug = slugFromSku(parsed.data.sku);
  if (!slug) return refused({ error: "Some fields need attention.", fields: { sku: "The item code needs a letter or digit." }, values });

  // A web address that once belonged to a product still redirects there, so
  // it can't be given to a new one.
  const { data: taken } = await supabase.from("redirects").select("from_slug").eq("from_slug", slug).maybeSingle();
  if (taken) {
    return refused({ error: "Some fields need attention.", fields: { sku: "This code's web address still redirects to another product." }, values });
  }

  const { data, error } = await supabase
    .from("products")
    .insert({ ...parsed.data, slug, status: "draft" })
    .select("id")
    .single();
  if (error) {
    const message = describeWriteError(error);
    return refused({ error: message, fields: error.code === "23505" ? { sku: message } : undefined, values });
  }
  redirect(`/admin/products/${data.id}?created=1`);
}

/** Deletes a product that has never been on the site. Anything that has
 *  been is hidden instead, so its history and old links survive. */
export async function deleteDraftProduct(input: { id: string }): Promise<{ ok: false; error: string }> {
  const { supabase } = await requireStaff();
  const id = z.uuid().safeParse(input.id);
  if (!id.success) return { ok: false, error: "That product isn't valid." };
  const { error } = await supabase.rpc("delete_draft_product", { p_id: id.data });
  if (error) {
    return {
      ok: false,
      error: error.code === "PT409" ? error.message : "It couldn't be deleted. Try again.",
    };
  }
  redirect("/admin/products");
}
