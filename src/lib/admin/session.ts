import "server-only";
import { redirect } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";

/**
 * The dashboard's gate, called at the top of every dashboard page and every
 * Server Action.
 *
 * The proxy already turns away anyone not signed in, but the proxy is not
 * trusted on its own: it sees the request, not the data. This checks again,
 * against the staff list, from inside the code that is about to act. And
 * row-level security checks a third time in the database, which is the layer
 * that actually enforces access.
 *
 * A signed-in person who has since been removed from the staff list is sent
 * back to sign-in with a reason, rather than shown a dashboard that refuses
 * every query.
 */
export async function requireStaff() {
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/admin/sign-in");

  const { data: isStaff, error } = await supabase.rpc("is_staff");
  // A check that failed (the database unreachable for a moment) is not an
  // answer: it shows the error screen with "Try again", rather than telling
  // someone they were taken off the staff list.
  if (error) throw new Error(`The staff check couldn't be made: ${error.message}`);
  if (!isStaff) redirect("/admin/sign-in?reason=removed");

  return { supabase, email: user.email.toLowerCase() };
}

/** Where to go after signing in: somewhere inside the dashboard, and never an
 *  address someone put in the link, which would make the sign-in page an
 *  open redirect. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && /^\/admin(\/[\w\-/]*)?(\?[\w\-=&%.,]*)?$/.test(next)
    ? next
    : "/admin";
}
