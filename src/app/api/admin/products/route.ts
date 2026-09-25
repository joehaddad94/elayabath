import { toGridRow } from "@/lib/admin/grid-row";
import { ADMIN_PRODUCT_COLUMNS, applyGridState, gridStateSchema } from "@/lib/admin/product-query";
import { serverClient } from "@/lib/supabase/server";

/**
 * One block of rows for the products grid.
 *
 * AG Grid's Infinite Row Model asks for rows startRow..endRow as the user
 * scrolls, with its sort and filter state; the database answers from the
 * `admin_products` view. The browser never holds the whole table, so the grid
 * behaves the same at 600 products or 60,000.
 *
 * Acts as the signed-in staff member: row-level security returns nothing to
 * anyone else, and this says so plainly rather than returning an empty grid.
 */
const BLOCK_MAX = 200;

export async function GET(request: Request) {
  const supabase = await serverClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in." }, { status: 401 });
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) return Response.json({ error: "Not on the staff list." }, { status: 403 });

  const url = new URL(request.url);
  const start = Math.max(0, Number(url.searchParams.get("start") ?? 0) | 0);
  const end = Math.min(start + BLOCK_MAX, Math.max(start + 1, Number(url.searchParams.get("end") ?? start + 100) | 0));

  let state;
  try {
    state = gridStateSchema.parse(JSON.parse(url.searchParams.get("state") ?? "{}"));
  } catch {
    return Response.json({ error: "Invalid grid state." }, { status: 400 });
  }

  const { data, count, error } = await applyGridState(
    supabase.from("admin_products").select(ADMIN_PRODUCT_COLUMNS, { count: "exact" }),
    state,
    true,
  ).range(start, end - 1);

  const headers = { "Cache-Control": "private, no-store" };

  // A block that starts past the last match (the filters narrowed while the
  // grid was scrolled down) is not an error: answer with no rows and the new
  // count, and the grid moves back within range.
  if (error?.code === "PGRST103") {
    const { count: total, error: countError } = await applyGridState(
      supabase.from("admin_products").select("id", { count: "exact", head: true }),
      state,
      false,
    );
    if (countError) return Response.json({ error: countError.message }, { status: 500 });
    return Response.json({ rows: [], lastRow: total ?? 0 }, { headers });
  }
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(
    { rows: (data ?? []).map((r) => toGridRow(r as unknown as Record<string, unknown>)), lastRow: count ?? 0 },
    { headers },
  );
}
