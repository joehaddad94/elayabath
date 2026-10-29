"use server";

import { z } from "zod";
import { publishOrder } from "@/lib/admin/publish";
import { requireStaff } from "@/lib/admin/session";

export async function saveFeaturedOrder(input: { ids: string[] }): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireStaff();
  const parsed = z.array(z.uuid()).max(1000).safeParse(input.ids);
  if (!parsed.success) return { ok: false, error: "That order isn't valid." };
  const { error } = await publishOrder(supabase, { kind: "featured", ids: parsed.data });
  return error ? { ok: false, error } : { ok: true };
}
