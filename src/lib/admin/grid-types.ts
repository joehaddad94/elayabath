/** One product on the Products list, as the browser receives it. Only what
 *  the list shows, searches, sorts or acts on: all of them are sent at once,
 *  so every field is paid for 600 times. */
export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  category_id: string;
  type_id: string | null;
  status: "draft" | "active";
  dimensions: string | null;
  image_url: string | null;
  /** What the product still lacks, in the editor's words ("photograph", …). */
  missing: string[];
  version: number;
  updated_at: string;
}
