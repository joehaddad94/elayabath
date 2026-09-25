"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { finishForm, slugify } from "@/lib/admin/catalogue-schema";
import { swatchFolder } from "@/lib/admin/media";
import { publishFinish } from "@/lib/admin/publish";
import { requireStaff } from "@/lib/admin/session";

export type FinishSaveResult =
  | { ok: true; version: number; message: string }
  | { ok: false; error: string; fields?: Record<string, string>; conflict?: boolean };

/**
 * Saves a finish as a draft, if nobody has saved it since it was loaded.
 * A published finish keeps its web address: the site's colour filters put it
 * in links people share.
 */
export async function saveFinish(input: { id: string; version: number; form: unknown }): Promise<FinishSaveResult> {
  const { supabase } = await requireStaff();
  const id = z.uuid().safeParse(input.id);
  const version = z.int().positive().safeParse(input.version);
  if (!id.success || !version.success) return { ok: false, error: "That save isn't valid. Reload the page." };
  const parsed = finishForm.safeParse(input.form);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Some fields need attention.", fields };
  }

  const { data: current } = await supabase.from("finishes").select("slug, swatch_path, published_version").eq("id", id.data).maybeSingle();
  if (!current) return { ok: false, error: "This finish no longer exists." };
  if (current.published_version !== null && parsed.data.slug !== current.slug) {
    return { ok: false, error: "Some fields need attention.", fields: { slug: "A published finish keeps its web address." } };
  }
  const swatch = parsed.data.swatch_path;
  if (swatch && swatch !== current.swatch_path && !swatch.startsWith(swatchFolder(id.data))) {
    return { ok: false, error: "The swatch didn't come from this finish's uploads. Upload it again." };
  }

  const { data: saved, error } = await supabase
    .from("finishes")
    .update(parsed.data)
    .eq("id", id.data)
    .eq("version", version.data)
    .select("version")
    .maybeSingle();
  if (error?.code === "23505") return { ok: false, error: "Some fields need attention.", fields: { slug: "Another finish already uses this address." } };
  if (error) return { ok: false, error: "That couldn't be saved. Try again." };
  if (!saved) {
    const { data: theirs } = await supabase.from("finishes").select("updated_by").eq("id", id.data).single();
    return { ok: false, conflict: true, error: `${theirs?.updated_by ?? "Someone"} saved this finish while you were editing it. Reload to see their version.` };
  }
  revalidatePath("/admin/finishes");
  return { ok: true, version: saved.version, message: "Saved as a draft. The site changes when you publish." };
}

export async function publishFinishNow(input: { id: string }): Promise<{ ok: boolean; error?: string; message?: string; version?: number }> {
  const { supabase } = await requireStaff();
  const id = z.uuid().safeParse(input.id);
  if (!id.success) return { ok: false, error: "That finish isn't valid." };
  const { error } = await publishFinish(supabase, id.data);
  if (error) return { ok: false, error: `It couldn't be published: ${error}` };
  const { data } = await supabase.from("finishes").select("published_version").eq("id", id.data).single();
  revalidatePath("/admin/finishes");
  return { ok: true, message: "Published. Product pages and filters show it now.", version: data?.published_version ?? undefined };
}

export async function deleteFinish(input: { id: string }): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireStaff();
  const id = z.uuid().safeParse(input.id);
  if (!id.success) return { ok: false, error: "That finish isn't valid." };
  const { error } = await supabase.rpc("delete_unused_finish", { p_id: id.data });
  if (error) return { ok: false, error: error.code === "PT409" ? error.message : "It couldn't be deleted. Try again." };
  revalidatePath("/admin/finishes");
  return { ok: true };
}

export type NewFinishState = {
  error?: string;
  fields?: Record<string, string>;
  values?: { name: string; code: string; family: string };
  created?: string;
  note?: string;
  attempt?: number;
};

/** A new finish is added unpublished. It goes live when published here, or
 *  with the first product that uses it. */
export async function createFinish(previous: NewFinishState, formData: FormData): Promise<NewFinishState> {
  const attempt = (previous.attempt ?? 0) + 1;
  const { supabase } = await requireStaff();
  const values = {
    name: String(formData.get("name") ?? ""),
    code: String(formData.get("code") ?? ""),
    family: String(formData.get("family") ?? ""),
  };
  const slug = slugify(`${values.code} ${values.name}`);
  const parsed = finishForm.safeParse({ ...values, slug, swatch_path: null, status: "active" });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { error: "Some fields need attention.", fields, values, attempt };
  }
  const { data: sameCode } = await supabase.from("finishes").select("name").eq("code", parsed.data.code).limit(1).maybeSingle();
  const { data, error } = await supabase.from("finishes").insert(parsed.data).select("id").single();
  if (error?.code === "23505") return { error: "A finish with this name and code already exists.", values, attempt };
  if (error) return { error: "It couldn't be created. Try again.", values, attempt };
  revalidatePath("/admin/finishes");
  return {
    created: data.id,
    // Allowed, since the client's own data has codes shared by two finishes,
    // but said out loud: a quote naming this code will be ambiguous.
    note: sameCode ? `Note that ${sameCode.name} already uses the code ${parsed.data.code}.` : undefined,
    attempt,
  };
}
