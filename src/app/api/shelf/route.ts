import { z } from "zod";
import { getShelf } from "@/lib/catalogue";
import { EMPTY_SELECTION, SORT_KEYS } from "@/lib/product-filters";

/**
 * One page of a category shelf, for the browser.
 *
 * The first page of every shelf is rendered with the page itself, which stays
 * static. Anything after that (a filter, a sort, "load more", or opening a
 * link someone shared with filters in it) asks here, and the database does
 * the filtering, counting and paging. Each distinct request is cached until
 * the next publish.
 */
const list = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").filter(Boolean).slice(0, 50) : []));

const query = z.object({
  category: z.string().min(1).max(80),
  type: list,
  material: list,
  colour: list,
  sort: z.enum(SORT_KEYS).catch("default"),
  offset: z.coerce.number().int().min(0).max(100_000).catch(0),
  limit: z.coerce.number().int().min(1).max(48).catch(24),
});

export async function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = query.safeParse(params);
  if (!parsed.success) {
    return Response.json({ error: "Invalid shelf request." }, { status: 400 });
  }
  const { category, type, material, colour, sort, offset, limit } = parsed.data;
  const selection = { ...EMPTY_SELECTION, type, material, colour };
  return Response.json(await getShelf(category, selection, sort, limit, offset));
}
