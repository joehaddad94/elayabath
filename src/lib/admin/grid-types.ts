/** One row of the products grid, as the browser receives it. */
export interface GridRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  category_id: string;
  category_slug: string;
  category_name: string;
  type_id: string | null;
  type_name: string | null;
  status: "draft" | "active";
  featured: boolean;
  dimensions: string | null;
  has_datasheet: boolean;
  image_url: string | null;
  finish_count: number;
  completeness: number;
  missing: string[];
  published_version: number | null;
  version: number;
  updated_at: string;
  updated_by: string | null;
}
