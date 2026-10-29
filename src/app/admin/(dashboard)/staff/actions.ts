"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/admin/session";

export type StaffState = { ok?: string; error?: string };

/**
 * Adding and removing staff, for the owner only. Both act as the signed-in
 * owner, so row-level security and the table's own guards decide: an
 * address the site publishes cannot be added, and neither the owner nor the
 * last member can be removed. The messages here only translate those
 * refusals into plain English.
 */

export async function addStaff(_prev: StaffState, formData: FormData): Promise<StaffState> {
  const { supabase } = await requireOwner();
  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Enter a full email address." };

  const { error } = await supabase.from("staff").insert({ email: parsed.data });
  if (error) {
    if (error.code === "23505") return { error: `${parsed.data} is already on the list.` };
    if (error.code === "23514") return { error: error.message };
    return { error: "That address couldn't be added. Try again." };
  }
  revalidatePath("/admin/staff");
  return { ok: `${parsed.data} can now sign in.` };
}

export async function removeStaff(_prev: StaffState, formData: FormData): Promise<StaffState> {
  const { supabase } = await requireOwner();
  const email = String(formData.get("email") ?? "").toLowerCase();

  const { error, count } = await supabase.from("staff").delete({ count: "exact" }).eq("email", email);
  if (error) {
    if (error.code === "23514") return { error: error.message };
    return { error: "That address couldn't be removed. Try again." };
  }
  if (!count) return { error: `${email} was not on the list.` };

  revalidatePath("/admin/staff");
  return { ok: `${email} can no longer sign in.` };
}
