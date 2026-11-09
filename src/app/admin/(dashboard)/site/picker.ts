import { storageUrl } from "@/lib/supabase/config";

/** A product as the homepage picker lists it. */
export interface PickerProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  imageUrl: string | null;
  /** Hidden products stay in the list but are not on the homepage. */
  hidden: boolean;
}

/** From a row of the admin_products view, whose columns are all nullable to
 *  the type generator though these come from not-null table columns. */
export function toPickerProduct(p: {
  id: string | null;
  name: string | null;
  sku: string | null;
  category_name: string | null;
  image_path: string | null;
  status: string | null;
}): PickerProduct {
  return {
    id: p.id!,
    name: p.name ?? "",
    sku: p.sku ?? "",
    category: p.category_name ?? "",
    imageUrl: p.image_path ? storageUrl("product-media", p.image_path) : null,
    hidden: p.status !== "active",
  };
}
