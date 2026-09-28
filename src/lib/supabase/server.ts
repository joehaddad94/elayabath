import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { fetchWithTimeout, publicConfig } from "./config";
import type { Database } from "./database.types";

/**
 * The client for the dashboard: server components and Server Actions,
 * acting as the signed-in staff member.
 *
 * It carries the staff member's own session, so every query runs under
 * their identity and row-level security decides what it may touch. This is
 * the client almost all dashboard code uses; the service key stays out of it.
 */
export async function serverClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = publicConfig();

  return createServerClient<Database>(url, publishableKey, {
    global: { fetch: fetchWithTimeout },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        // A server component cannot set cookies. That is fine: the proxy
        // refreshes the session on every /admin request, so a component
        // only ever needs to read it.
        try {
          for (const { name, value, options } of toSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /* called from a server component */
        }
      },
    },
  });
}
