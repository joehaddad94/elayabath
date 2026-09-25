"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/**
 * The client for dashboard components that run in the browser, which in
 * practice means uploads: files go straight from the browser to Storage
 * rather than through a Server Action, because the hosting platform caps a
 * function's request body well below the size of a phone photo.
 *
 * Reads NEXT_PUBLIC_ variables directly, since those are inlined at build
 * time and the server-side config module is not available here.
 */
export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase is not configured.");
  return createBrowserClient<Database>(url, key);
}
