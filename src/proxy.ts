import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every /admin request, and before product pages opened in
 * preview (draft mode), and nowhere else.
 *
 * Two jobs. It refreshes the Supabase session, so a staff member signed in
 * yesterday stays signed in today (a server component can read cookies but
 * not write them, so the refresh has to happen here). And it turns away
 * anyone not signed in before a dashboard page renders.
 *
 * It is the first of three checks, not the only one: it knows a session
 * exists, not whether its owner is still on the staff list. Every dashboard
 * page and action checks that again (lib/admin/session.ts), and row-level
 * security checks it a third time in the database.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return new NextResponse("The dashboard is not configured on this deployment.", { status: 503 });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getUser, not getSession: it asks the Auth server rather than trusting
  // whatever the cookie claims.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // A product page in preview reads the draft as the signed-in staff member
  // (lib/preview.ts), so the session needs the same refresh here. Nobody is
  // turned away: without a staff session the page is simply the live one.
  if (!pathname.startsWith("/admin")) {
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  const isPublic = pathname === "/admin/sign-in" || pathname.startsWith("/admin/auth/");

  if (!user && !isPublic) {
    const target = request.nextUrl.clone();
    target.pathname = "/admin/sign-in";
    target.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(target);
  }

  if (user && pathname === "/admin/sign-in" && !request.nextUrl.searchParams.has("reason")) {
    const target = request.nextUrl.clone();
    target.pathname = "/admin";
    target.search = "";
    return NextResponse.redirect(target);
  }

  // Never cached by a CDN or a browser: every response here is personal.
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

// `__prerender_bypass` is the cookie `draftMode().enable()` sets; only the
// staff-only preview route sets it. Next reads this config at build time, so
// the values must be written out as literals.
export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    { source: "/product/:path*", has: [{ type: "cookie", key: "__prerender_bypass" }] },
    { source: "/:locale/product/:path*", has: [{ type: "cookie", key: "__prerender_bypass" }] },
  ],
};
