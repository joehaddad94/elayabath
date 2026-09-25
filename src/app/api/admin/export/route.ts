import { z } from "zod";
import { exportStream } from "@/lib/admin/export";
import { gridStateSchema } from "@/lib/admin/grid-state";
import { ENTITY_LABEL } from "@/lib/admin/import-fields";
import { serverClient } from "@/lib/supabase/server";

const params = z.object({
  entity: z.enum(["products", "categories", "finishes", "product_finishes"]),
  format: z.enum(["csv", "xlsx"]).default("csv"),
  scope: z.enum(["all", "view", "ids", "template"]).default("all"),
  source: z.enum(["working", "published"]).default("working"),
  ids: z.string().max(200_000).optional(),
  state: z.string().max(20_000).optional(),
  columns: z.string().max(2000).optional(),
});

/**
 * A spreadsheet download: the whole entity, the grid's current view, the
 * ticked rows, or a blank template; from the working copy or the live site.
 * Staff only, and never cached.
 */
export async function GET(request: Request) {
  return download(Object.fromEntries(new URL(request.url).searchParams));
}

/** The same, from a form: ticked rows can be thousands of ids, too many for
 *  a link. */
export async function POST(request: Request) {
  const form = await request.formData();
  return download(Object.fromEntries([...form.entries()].map(([k, v]) => [k, String(v)])));
}

async function download(input: Record<string, string>) {
  const supabase = await serverClient();
  const { data: isStaff } = await supabase.rpc("is_staff");
  if (!isStaff) return Response.json({ error: "Staff only." }, { status: 403 });

  const parsed = params.safeParse(input);
  if (!parsed.success) return Response.json({ error: "That export isn't valid." }, { status: 400 });
  const p = parsed.data;
  let state;
  if (p.scope === "view") {
    const s = gridStateSchema.safeParse(JSON.parse(p.state ?? "{}"));
    if (!s.success) return Response.json({ error: "That view isn't valid." }, { status: 400 });
    state = s.data;
  }
  const ids = p.ids?.split(",").filter((id) => /^[0-9a-f-]{36}$/i.test(id));

  const date = new Date().toISOString().slice(0, 10);
  const name = `elaya-${ENTITY_LABEL[p.entity].toLowerCase().replace(/\s+/g, "-")}${p.scope === "template" ? "-template" : p.source === "published" ? "-live" : ""}-${date}.${p.format}`;
  return new Response(exportStream(supabase, { entity: p.entity, format: p.format, scope: p.scope, source: p.source, ids, state, columns: p.columns?.split(",") }), {
    headers: {
      "Content-Type": p.format === "csv" ? "text/csv; charset=utf-8" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
