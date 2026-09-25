import { serverClient } from "@/lib/supabase/server";

const OUTCOMES = new Set(["new", "changed", "unchanged", "skipped", "error"]);

/** One block of an import's checked rows, for the preview grid. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await serverClient();
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) return Response.json({ error: "Staff only." }, { status: 403 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: "Which import?" }, { status: 400 });

  const url = new URL(request.url);
  const start = Math.max(0, Number(url.searchParams.get("start") ?? 0) | 0);
  const end = Math.min(start + 200, Math.max(start + 1, Number(url.searchParams.get("end") ?? start + 100) | 0));
  const outcome = url.searchParams.get("outcome") ?? "";

  let query = supabase
    .from("import_rows")
    .select("row_number, outcome, key, diff, errors, applied", { count: "exact" })
    .eq("job_id", id)
    .order("row_number");
  if (OUTCOMES.has(outcome)) query = query.eq("outcome", outcome);
  const { data, count, error } = await query.range(start, end - 1);
  if (error?.code === "PGRST103") return Response.json({ rows: [], lastRow: count ?? 0 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ rows: data ?? [], lastRow: count ?? 0 }, { headers: { "Cache-Control": "private, no-store" } });
}
