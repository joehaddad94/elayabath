import { getSearchIndex } from "@/lib/catalogue";

/**
 * The search index, as a URL.
 *
 * It used to be a JSON file the search page imported dynamically, which tied
 * search to a file on disk. Serving it from a route puts it behind the
 * catalogue seam like every other read, so when the catalogue moves to the
 * database this route keeps its URL and only its source changes.
 *
 * Static: built once per deploy and served from the CDN.
 */
export const dynamic = "force-static";

export async function GET() {
  return Response.json(await getSearchIndex());
}
