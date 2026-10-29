"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { categoryForm, slugify } from "@/lib/admin/catalogue-schema";
import { publishCategory, publishOrder } from "@/lib/admin/publish";
import { requireStaff } from "@/lib/admin/session";

export type CategorySaveResult =
  | { ok: true; version: number; message: string }
  | { ok: false; error: string; fields?: Record<string, string>; conflict?: { by: string | null; at: string } };

const fieldErrors = (issues: z.core.$ZodIssue[]) => {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[String(issue.path[0])] ??= issue.message;
  return fields;
};

/**
 * Saves a category and its product types, version-checked, through
 * `public.save_category`, and puts it live: visible, or hidden from the menu
 * and with no category page.
 *
 * A published category's web address is fixed: product addresses redirect
 * when they change, category addresses do not, so changing one would break
 * every link to it.
 */
export async function saveCategory(input: { id: string; version: number; form: unknown }): Promise<CategorySaveResult> {
  const { supabase } = await requireStaff();
  const id = z.uuid().safeParse(input.id);
  const version = z.int().positive().safeParse(input.version);
  if (!id.success || !version.success) return { ok: false, error: "That save isn't valid. Reload the page." };
  const parsed = categoryForm.safeParse(input.form);
  if (!parsed.success) return { ok: false, error: "Some fields need attention.", fields: fieldErrors(parsed.error.issues) };
  const { types, ...fields } = parsed.data;

  const { data: current } = await supabase.from("categories").select("slug, published_version").eq("id", id.data).maybeSingle();
  if (!current) return { ok: false, error: "This category no longer exists." };
  if (current.published_version !== null && fields.slug !== current.slug) {
    return { ok: false, error: "Some fields need attention.", fields: { slug: "A published category keeps its web address." } };
  }
  // Visible or hidden; a category never yet on the site counts as hidden.
  if (fields.status === "draft") fields.status = "discontinued";

  // New types get an address from their name, unique within the category.
  const { data: existing } = await supabase.from("product_types").select("slug").eq("category_id", id.data);
  const taken = new Set((existing ?? []).map((t) => t.slug));
  const withSlugs = types.map((t) => {
    if (t.id) return { id: t.id, name: t.name };
    const base = slugify(t.name) || "type";
    let candidate = base;
    for (let n = 2; taken.has(candidate); n++) candidate = `${base}-${n}`;
    taken.add(candidate);
    return { name: t.name, slug: candidate };
  });

  const { data: saved, error } = await supabase.rpc("save_category", {
    p_id: id.data,
    p_version: version.data,
    p_fields: fields,
    p_types: withSlugs,
  });
  if (error?.code === "PT409") {
    const { data: theirs } = await supabase.from("categories").select("updated_by, updated_at").eq("id", id.data).single();
    return {
      ok: false,
      error: `${theirs?.updated_by ?? "Someone"} saved this category while you were editing it. Reload to see their version.`,
      conflict: theirs ? { by: theirs.updated_by, at: theirs.updated_at } : undefined,
    };
  }
  if (error?.code === "PT422") return { ok: false, error: error.message };
  if (error?.code === "23505") return { ok: false, error: "Some fields need attention.", fields: { slug: "Another category already uses this address." } };
  if (error || saved === null) return { ok: false, error: "That couldn't be saved. Try again." };

  const { error: liveError } = await publishCategory(supabase, id.data);
  if (liveError) return { ok: false, error: `Saved, but the site couldn't be updated: ${liveError} Save again to retry.` };
  return {
    ok: true,
    version: saved,
    message: fields.status === "active" ? "Saved. Menus, shelves and its product pages show it now." : "Saved. It is hidden: no menu entry or category page.",
  };
}

const ids = z.array(z.uuid()).max(5000);

export async function saveCategoryOrder(input: { ids: string[] }): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireStaff();
  const parsed = ids.safeParse(input.ids);
  if (!parsed.success) return { ok: false, error: "That order isn't valid." };
  const { error } = await publishOrder(supabase, { kind: "categories", ids: parsed.data });
  return error ? { ok: false, error } : { ok: true };
}

export async function saveProductOrder(input: { categoryId: string; ids: string[] }): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireStaff();
  const category = z.uuid().safeParse(input.categoryId);
  const parsed = ids.safeParse(input.ids);
  if (!category.success || !parsed.success) return { ok: false, error: "That order isn't valid." };
  const { error } = await publishOrder(supabase, { kind: "products", categoryId: category.data, ids: parsed.data });
  return error ? { ok: false, error } : { ok: true };
}

export type NewCategoryState = { error?: string; fields?: Record<string, string>; values?: { name: string }; attempt?: number };

/** A new category starts hidden, last in the menu, with an address made
 *  from its name. It goes on the site when it is made visible and saved. */
export async function createCategory(previous: NewCategoryState, formData: FormData): Promise<NewCategoryState> {
  const refused = (state: Omit<NewCategoryState, "attempt">): NewCategoryState => ({ ...state, attempt: (previous.attempt ?? 0) + 1 });
  const { supabase } = await requireStaff();
  const name = String(formData.get("name") ?? "").trim();
  const parsed = categoryForm.shape.name.safeParse(name);
  if (!parsed.success) return refused({ error: parsed.error.issues[0]?.message, values: { name } });
  const slug = slugify(name);
  if (!slug) return refused({ error: "The name needs a letter or digit.", values: { name } });

  const { data: last } = await supabase.from("categories").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: parsed.data, slug, status: "draft", position: (last?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (error?.code === "23505") return refused({ error: "A category with this address already exists.", values: { name } });
  if (error) return refused({ error: "It couldn't be created. Try again.", values: { name } });
  redirect(`/admin/categories/${data.id}`);
}
