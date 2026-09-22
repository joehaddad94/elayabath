import { ProductCard } from "@/components/ProductCard/ProductCard";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import type { Product } from "@/lib/types";
import styles from "./ProductGrid.module.css";

export function ProductGrid({
  products,
  locale,
  t,
  id,
  priorityCount = 0,
}: {
  products: Product[];
  locale: Locale;
  t: Dictionary;
  id?: string;
  /** How many images to mark priority. Only ones above the fold on a
   *  desktop first paint; marking more would fight itself. */
  priorityCount?: number;
}) {
  return (
    <div className={styles.grid} id={id}>
      {products.map((product, index) => (
        <ProductCard
          key={product.slug}
          product={product}
          locale={locale}
          t={t}
          priority={index < priorityCount}
        />
      ))}
    </div>
  );
}
