import { searchProducts } from "@/lib/catalogue";

/**
 * Search, answered by the database one query at a time.
 *
 * This replaced /api/search-index, which sent every visitor who opened search
 * the whole catalogue index to match against in the browser: 4 KB at 50
 * products, 45 KB at 596, and far too much at tens of thousands. Matching now
 * runs in Postgres (public.search_catalogue) under the same rules, and each
 * distinct query is cached until the next publish.
 */
export async function GET(request: Request) {
  const query = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 100);
  return Response.json(await searchProducts(query));
}
