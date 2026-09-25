import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ENTITY_LABEL, type Entity, type ImportOptions } from "@/lib/admin/import-fields";
import { requireStaff } from "@/lib/admin/session";
import styles from "../../../admin.module.css";
import { ImportJob } from "./ImportJob";

export const metadata: Metadata = { title: "Import" };

export default async function ImportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireStaff();

  const { data: job } = await supabase.from("import_jobs").select("*").eq("id", id).maybeSingle();
  if (!job) notFound();
  const [{ data: sample }, { data: presets }, { count: tagged }] = await Promise.all([
    supabase.from("import_rows").select("raw").eq("job_id", id).order("row_number").limit(3),
    supabase.from("mapping_presets").select("name, mapping").eq("entity", job.entity).order("name"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("import_job_id", id),
  ]);
  const mapping = job.mapping as { headers: string[]; columns: Record<string, string>; preset: string | null; grouped?: boolean; links?: number };

  return (
    <>
      <p className={styles.crumbs}>
        <Link href="/admin/imports">Import and export</Link> / {job.file_name}
      </p>
      <div className={styles.pageHead}>
        <div>
          <h1>Import: {ENTITY_LABEL[job.entity as Entity]}</h1>
          <p>
            {job.file_name}, {((job.counts as { total?: number }).total ?? 0).toLocaleString("en")} rows
            {mapping.links ? ` (${mapping.links.toLocaleString("en")} links, grouped per product)` : ""}, started by {job.created_by}.
          </p>
        </div>
      </div>
      <ImportJob
        key={`${job.id}:${job.status}`}
        job={{
          id: job.id,
          entity: job.entity as Entity,
          status: job.status,
          counts: job.counts as Record<string, number>,
          headers: mapping.headers,
          columns: mapping.columns,
          grouped: Boolean(mapping.grouped),
          preset: mapping.preset,
          options: job.options as unknown as ImportOptions,
          error: job.error,
          tagged: tagged ?? 0,
        }}
        sample={(sample ?? []).map((s) => s.raw as string[])}
        presets={(presets ?? []).map((p) => ({ name: p.name, mapping: p.mapping as Record<string, string> }))}
      />
    </>
  );
}
