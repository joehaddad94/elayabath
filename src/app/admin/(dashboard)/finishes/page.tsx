import type { Metadata } from "next";
import { fetchAll } from "@/lib/admin/fetch-all";
import { requireStaff } from "@/lib/admin/session";
import { storageUrl } from "@/lib/supabase/config";
import styles from "../../admin.module.css";
import { FinishLibrary, type LibraryFinish } from "./FinishLibrary";

export const metadata: Metadata = { title: "Finishes" };

/** The finish library: every finish, what uses it, and its state. */
export default async function FinishesPage({ searchParams }: { searchParams: Promise<{ finish?: string }> }) {
  const { finish: selected } = await searchParams;
  const { supabase } = await requireStaff();
  const [finishes, { data: usage }, { data: shared }] = await Promise.all([
    fetchAll((from, to) =>
      supabase
        .from("finishes")
        .select("id, slug, code, name, family, swatch_path, status, version, published_version, updated_at, updated_by")
        .order("family")
        .order("code")
        .range(from, to),
    ),
    supabase.from("finish_usage").select("id, products, live_products").limit(5000),
    supabase.from("duplicate_finish_codes").select("code"),
  ]);
  const used = new Map((usage ?? []).map((u) => [u.id, u]));
  const sharedCodes = new Set((shared ?? []).map((s) => s.code));

  const rows: LibraryFinish[] = finishes.map((f) => ({
    id: f.id,
    version: f.version,
    publishedVersion: f.published_version,
    swatchUrl: f.swatch_path ? storageUrl("swatches", f.swatch_path) : null,
    products: used.get(f.id)?.products ?? 0,
    liveProducts: used.get(f.id)?.live_products ?? 0,
    sharedCode: sharedCodes.has(f.code),
    form: {
      name: f.name,
      code: f.code,
      slug: f.slug,
      family: f.family as LibraryFinish["form"]["family"],
      swatch_path: f.swatch_path,
      status: f.status,
    },
  }));

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>Finishes</h1>
          <p>
            The finish library every product picks from. A finish in use can be retired, which hides it from the
            picker and the site&apos;s filters, but not deleted.
          </p>
        </div>
      </div>
      <FinishLibrary finishes={rows} selected={selected} />
    </>
  );
}
