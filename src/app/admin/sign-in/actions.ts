"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/admin/session";
import { adminClient } from "@/lib/supabase/admin";
import { serverClient } from "@/lib/supabase/server";

export type SignInState = { error?: string; sent?: string };

/** The same answer for an unknown address and a published one, so the form
 *  says nothing about which addresses exist. */
const REFUSED = "That address can't sign in to the dashboard.";
const THROTTLED = "Too many attempts from this connection. Try again in 15 minutes.";
const FAILED = "Sign-in didn't work. Try again in a moment.";

const WINDOW_MINUTES = 15;
const MAX_REFUSALS = 10;

/**
 * Sign in to the dashboard.
 *
 * Two modes, chosen by the ADMIN_SIGN_IN setting:
 *
 * - Direct (the default, while no email provider is configured): an address
 *   on the staff list gets a session at once. The server asks Auth for a
 *   sign-in token without sending anything and redeems it on the spot. Under
 *   this mode the address is the only credential, which is the trade-off
 *   recorded in CMS-PLAN.md; failed attempts are counted per connection and
 *   cut off after ten in fifteen minutes.
 * - Link ("link"): a magic link to the same address. Nothing else changes.
 *
 * This is the one Server Action that uses the service key: the staff list is
 * not readable before sign-in, and opening a session without an email needs
 * it. Every other dashboard write acts as the signed-in staff member.
 */
export async function signIn(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = z
    .email()
    .safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { error: "Enter a full email address." };
  const email = parsed.data;
  const next = safeNext(formData.get("next"));

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const userAgent = h.get("user-agent")?.slice(0, 200) ?? null;

  const admin = adminClient();

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const refusals = await admin
    .from("sign_in_log")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("method", "refused")
    .gte("at", since);
  if ((refusals.count ?? 0) >= MAX_REFUSALS) return { error: THROTTLED };

  const listed = await admin.from("staff").select("email").eq("email", email).maybeSingle();
  if (!listed.data) {
    await admin.from("sign_in_log").insert({ email, method: "refused", ip, user_agent: userAgent });
    return { error: REFUSED };
  }

  const supabase = await serverClient();

  if (process.env.ADMIN_SIGN_IN === "link") {
    const origin = h.get("origin") ?? `http://${h.get("host")}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/admin/auth/confirm?next=${encodeURIComponent(next)}` },
    });
    if (error) return { error: FAILED };
    return { sent: email };
  }

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  const token = link.data?.properties;
  if (link.error || !token) return { error: FAILED };

  // A first sign-in is issued a signup token and a returning one a magiclink
  // token; redeeming with the wrong type fails, so use the one Auth reports.
  const verified = await supabase.auth.verifyOtp({
    type: token.verification_type as EmailOtpType,
    token_hash: token.hashed_token,
  });
  if (verified.error) return { error: FAILED };

  await admin.from("sign_in_log").insert({ email, method: "direct", ip, user_agent: userAgent });
  redirect(next);
}

export async function signOut() {
  const supabase = await serverClient();
  await supabase.auth.signOut();
  redirect("/admin/sign-in");
}
