import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { tags } from "@/lib/cache-tags";
import { adminClient } from "@/lib/supabase/admin";
import { serverClient } from "@/lib/supabase/server";

/**
 * Refreshes every cached page of the public site from the database.
 *
 * Publishing from the dashboard refreshes exactly what it changed. Anything
 * that changes the database another way (the seed, a move, a script, SQL by
 * hand, the end-to-end tests putting data back) leaves cached pages showing
 * what was there before; this is the fix, in place of a redeploy:
 *
 *   curl -X POST https://<site>/api/admin/revalidate -H "Authorization: Bearer <secret key>"
 *
 * Allowed with the service key, or for a signed-in staff member.
 */
export async function POST(request: Request) {
  if (!(await allowed(request))) return Response.json({ error: "Staff or the service key only." }, { status: 403 });

  // Every product page has its own tag, so each published address is named.
  const slugs: string[] = [];
  const db = adminClient();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("published_products").select("slug").order("slug").range(from, from + 999);
    if (error) return Response.json({ error: error.message }, { status: 500 });
    slugs.push(...(data ?? []).map((p) => p.slug));
    if ((data ?? []).length < 1000) break;
  }
  const { data: redirects } = await db.from("redirects").select("from_slug");
  slugs.push(...(redirects ?? []).map((r) => r.from_slug));

  // Expire at once rather than serve stale once: whoever asked for this
  // wants the next visit to show the database as it is.
  const now = { expire: 0 };
  for (const tag of [tags.products, tags.categories, tags.finishes, tags.meta]) revalidateTag(tag, now);
  for (const slug of slugs) revalidateTag(tags.product(slug), now);

  return Response.json({ refreshed: slugs.length + 4 }, { headers: { "Cache-Control": "no-store" } });
}

async function allowed(request: Request): Promise<boolean> {
  const secret = process.env.SUPABASE_SECRET_KEY ?? "";
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret))) return true;
  const supabase = await serverClient();
  const { data } = await supabase.rpc("is_staff");
  return data === true;
}
