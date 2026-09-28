import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fetchWithTimeout, publicConfig } from "./config";
import type { Database } from "./database.types";

/**
 * The client the public site reads the catalogue with.
 *
 * No session and no cookies, on purpose. Visitors are anonymous, the read
 * model is readable by anyone, and a read that touched cookies could not be
 * cached: every catalogue page would become dynamic. Row-level security
 * limits this client to the published tables whatever code calls it.
 */
let client: SupabaseClient<Database> | undefined;

export function publicClient(): SupabaseClient<Database> {
  if (!client) {
    const { url, publishableKey } = publicConfig();
    client = createClient<Database>(url, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchWithTimeout },
    });
  }
  return client;
}
