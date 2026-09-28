import "server-only";
import { createClient } from "@supabase/supabase-js";
import { fetchWithTimeout, publicConfig } from "./config";
import type { Database } from "./database.types";

/**
 * The one place the service key enters the running app.
 *
 * It bypasses row-level security entirely, so it is used only for signing
 * in, where there is no signed-in user yet to act as:
 *
 *   - app/admin/sign-in/actions.ts checks the address against the staff list
 *     (unreadable before sign-in), counts recent refusals to throttle
 *     guessing, issues and redeems a sign-in token without sending an email,
 *     and records the attempt;
 *   - app/admin/auth/confirm/route.ts records a magic-link sign-in.
 *
 * Everything else in the app acts as the signed-in staff member and is held
 * to row-level security. Adding a caller should be a deliberate decision,
 * reviewed as one.
 */
export function adminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set.");
  return createClient<Database>(publicConfig().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout },
  });
}
