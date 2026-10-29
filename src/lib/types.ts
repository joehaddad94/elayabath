/**
 * The shape of the catalogue.
 *
 * These types are the contract between the ingest pipeline and every page.
 * The pipeline is the only code that knows the source archive exists; from
 * here down, everything sees clean records that are guaranteed to have been
 * validated at write time.
 */

/** The material a finish belongs to. The live site's own colour codes encode
 *  this in their prefix: C is ceramic, SS solid surface, CR concrete, M
 *  marble, RT resin, A acrylic, P plated metal. The filter groups by it. */
export type FinishFamily =
  | "ceramic"
  | "solid-surface"
  | "resin"
  | "marble"
  | "concrete"
  | "acrylic"
  | "plating";

export const FINISH_FAMILY_NAMES: Record<FinishFamily, string> = {
  ceramic: "Ceramic",
  "solid-surface": "Solid surface",
  resin: "Resin",
  marble: "Marble",
  concrete: "Concrete",
  acrylic: "Acrylic",
  plating: "Metal finish",
};

export interface Finish {
  /** The live site's attribute slug, e.g. `c00-white`. Used in URLs. */
  slug: string;
  /** The code the client uses on quotes and samples, e.g. `C00`. */
  code: string;
  /** Human name derived from the slug, e.g. `White`.
   *  Their typos are preserved rather than corrected: see README. */
  name: string;
  family: FinishFamily;
  familyName: string;
  /** Path under public/, or null where no swatch exists on their server. */
  image: string | null;
}

export interface ProductType {
  slug: string;
  name: string;
}

export interface Product {
  /** The client's item code. The identifier everywhere: quotes, data sheets,
   *  drawings. Two of them contain a space and a plus sign, so never assume
   *  it is URL-safe. Use `slug`. */
  sku: string;
  /** URL-safe form of the SKU. */
  slug: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  type: ProductType;
  /** e.g. `600 x 350 x 150 mm`, or null where the client never published it. */
  dimensions: string | null;
  description: string;
  /** e.g. `Without Tap Hole`, `Center Outlet`. */
  features: string[];
  /** The card and hero image, which is the first of the gallery. Null when
   *  staff have published a product before photographing it: the dashboard
   *  flags that as incomplete but does not block it. */
  image: ProductImage | null;
  /** Every photograph, in the order staff set. */
  gallery?: ProductImage[];
  /** Finish slugs, in the order the client lists them. May be empty: some
   *  products genuinely have no finish options recorded. */
  finishes: string[];
  /** A photograph of the product in a particular finish, where one exists,
   *  keyed by finish slug. The room left for variants. */
  finishImages?: Record<string, string>;
  /** Distinct families across this product's finishes, for filtering. */
  materials: FinishFamily[];
  /** URL of the technical data sheet, or null where there is none. */
  datasheet: string | null;
  /** Only visible products are on the site. Absent means active. */
  status?: "active";
}

export interface ProductImage {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
}

export interface FacetOption<T extends string = string> {
  value: T;
  label: string;
  count: number;
}

export interface Category {
  slug: string;
  name: string;
  /** The client's own verbatim copy, where a category has any. Most do not. */
  blurb: string[] | null;
  /** Number of products in this category present in the built dataset. */
  count: number;
  /** Total in the client's full catalogue, which is larger than the slice
   *  this build ships. Shown so counts never claim to be complete. */
  totalInCatalogue: number;
  image: string | null;
  icon: string | null;
  productTypes: FacetOption[];
  materials: FacetOption<FinishFamily>[];
  /** Finish slugs present in this category, for the colour facet. */
  finishes: string[];
}

/** One row of the client-side search index. Deliberately small: it is
 *  downloaded by every visitor who opens search. */
export interface SearchEntry {
  s: string; // slug
  n: string; // name
  k: string; // sku
  t: string; // type
  c: string; // category name
}

export interface CatalogueMeta {
  /** When the ingest last ran. */
  generatedAt: string;
  /** How many products this build ships. */
  products: number;
  /** How many exist in the client's full catalogue. */
  productsInCatalogue: number;
  categoriesInCatalogue: number;
  finishesInCatalogue: number;
}

/** One page of a category shelf, as the database returns it. */
export interface ShelfPage {
  /** Products matching the selection, in total, not just on this page. */
  total: number;
  products: Product[];
  facets: {
    type: FacetOption[];
    material: FacetOption<FinishFamily>[];
    colour: Array<{ value: string; count: number }>;
  };
}
