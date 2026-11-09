import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
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
 *
 * Wrapped in React's cache, so the layout and the page share one check per
 * request instead of each making their own.
 */
export const requireStaff = cache(async () => {
  const supabase = await serverClient();
  // getClaims verifies the session's signed token locally (against the
  // project's published keys) instead of asking the Auth server on every
  // render. The proxy has already refreshed the session for this request.
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims.email === "string" ? data.claims.email : "";
  if (!email) redirect("/admin/sign-in");

  // Both checks at once: one round trip, not two in a row.
  const [staff, owner] = await Promise.all([supabase.rpc("is_staff"), supabase.rpc("is_owner")]);
  // A check that failed (the database unreachable for a moment) is not an
  // answer: it shows the error screen with "Try again", rather than telling
  // someone they were taken off the staff list.
  if (staff.error) throw new Error(`The staff check couldn't be made: ${staff.error.message}`);
  if (!staff.data) redirect("/admin/sign-in?reason=removed");
  if (owner.error) throw new Error(`The owner check couldn't be made: ${owner.error.message}`);

  return { supabase, email: email.toLowerCase(), isOwner: owner.data === true };
});

/**
 * The gate for the Staff page and its actions: the owner only. Anyone else
 * on the staff list is told the page doesn't exist, the same answer as for
 * any address that isn't there. Row-level security holds the same line.
 */
export async function requireOwner() {
  const staff = await requireStaff();
  if (!staff.isOwner) notFound();
  return staff;
}

/** Where to go after signing in: somewhere inside the dashboard, and never an
 *  address someone put in the link, which would make the sign-in page an
 *  open redirect. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && /^\/admin(\/[\w\-/]*)?(\?[\w\-=&%.,]*)?$/.test(next)
    ? next
    : "/admin";
}
