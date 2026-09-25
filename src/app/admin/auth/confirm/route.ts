import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/admin/session";
import { adminClient } from "@/lib/supabase/admin";
import { serverClient } from "@/lib/supabase/server";

/**
 * Where a magic link lands, once an email provider is configured and
 * ADMIN_SIGN_IN is "link". Redeems the token from the link, records the
 * sign-in, and continues to wherever the person was going.
 *
 * Unused under direct sign-in, but kept working so switching modes is a
 * setting, not a code change.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"));

  if (tokenHash && type) {
    const supabase = await serverClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error && data.user?.email) {
      await adminClient().from("sign_in_log").insert({
        email: data.user.email.toLowerCase(),
        method: "link",
        ip: (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "local",
        user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
      });
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/admin/sign-in?reason=link", url.origin));
}
