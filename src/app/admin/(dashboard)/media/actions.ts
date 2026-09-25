"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/admin/session";

export type CleanupState = { ok?: string; error?: string };

const CHUNK = 100;

/**
 * Removes every file nothing uses: not the working copy, not the live site,
 * not any published version in the history. The database decides what is
 * unused (`public.unused_media`, with a day's grace for uploads whose
 * product is still being edited); Storage does the deleting, as the
 * signed-in staff member.
 */
export async function removeUnusedMedia(): Promise<CleanupState> {
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc("unused_media");
  if (error) return { error: "The list of unused files couldn't be read. Try again." };
  if (!data?.length) return { ok: "Nothing to remove." };

  const byBucket = new Map<string, string[]>();
  for (const f of data) byBucket.set(f.bucket_id, [...(byBucket.get(f.bucket_id) ?? []), f.name]);

  let removed = 0;
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += CHUNK) {
      const { data: gone, error: removeError } = await supabase.storage.from(bucket).remove(names.slice(i, i + CHUNK));
      if (removeError) return { error: `Stopped after ${removed} files: ${removeError.message}` };
      removed += gone?.length ?? 0;
    }
  }
  revalidatePath("/admin/media");
  return { ok: `${removed} unused file${removed === 1 ? "" : "s"} removed.` };
}
