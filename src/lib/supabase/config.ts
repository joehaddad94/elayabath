import { z } from "zod";

/**
 * Supabase settings, read once and validated.
 *
 * Everything that differs between Joe's development project, a local stack
 * and Elaya's own account lives here and only here, as environment
 * variables. Moving accounts is a change of these values and nothing else.
 *
 * Read lazily: the public site must still build before Supabase exists (the
 * catalogue reads JSON until milestone C4), so a missing value is an error
 * only at the moment something actually needs it.
 */

const publicSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(20),
});

export interface PublicSupabaseConfig {
  url: string;
  publishableKey: string;
}

export function publicConfig(): PublicSupabaseConfig {
  const parsed = publicSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).",
    );
  }
  return parsed.data;
}

/** Public URL of an object in a public bucket. The database stores paths,
 *  never URLs, so the host can change without rewriting data. */
export function storageUrl(bucket: string, path: string): string {
  const { url } = publicConfig();
  const clean = path.replace(/^\/+/, "");
  return `${url}/storage/v1/object/public/${bucket}/${clean}`;
}
