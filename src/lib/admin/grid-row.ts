import "server-only";
import { storageUrl } from "@/lib/supabase/config";
import type { GridRow } from "./grid-types";

export type { GridRow };


/** A row from `admin_products`, with its image path turned into a URL on the
 *  server, so the browser never needs to know where Storage lives. */
export function toGridRow(row: Record<string, unknown>): GridRow {
  const { image_path, ...rest } = row as Omit<GridRow, "image_url"> & { image_path: string | null };
  return {
    ...(rest as Omit<GridRow, "image_url">),
    image_url: image_path ? storageUrl("product-media", image_path) : null,
  };
}
