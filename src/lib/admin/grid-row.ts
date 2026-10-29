import "server-only";
import { storageUrl } from "@/lib/supabase/config";
import type { ProductRow } from "./grid-types";

export type { ProductRow };

/** The `admin_products` columns a list row is made from. */
export const LIST_COLUMNS = "id, sku, name, category_id, type_id, status, dimensions, image_path, missing, version, updated_at";

/** A row from `admin_products`, with its image path turned into a URL on the
 *  server, so the browser never needs to know where Storage lives. */
export function toProductRow(row: Record<string, unknown>): ProductRow {
  const { image_path, ...rest } = row as Omit<ProductRow, "image_url"> & { image_path: string | null };
  return { ...rest, missing: rest.missing ?? [], image_url: image_path ? storageUrl("product-media", image_path) : null };
}
