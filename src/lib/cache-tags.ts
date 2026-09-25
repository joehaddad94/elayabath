/**
 * Cache tags, shared by the reads that set them and the publish actions that
 * clear them.
 *
 * Data-free, so both the public catalogue and the dashboard can import it.
 * Deliberately coarse for lists and precise for single products: publishing
 * one product refreshes its own page and every list, but not the other 539
 * product pages.
 */
export const tags = {
  /** Any list of products: shelves, the homepage, search, related, sitemap. */
  products: "products",
  /** One product's page. */
  product: (slug: string) => `product:${slug}`,
  categories: "categories",
  finishes: "finishes",
  meta: "catalogue-meta",
} as const;
