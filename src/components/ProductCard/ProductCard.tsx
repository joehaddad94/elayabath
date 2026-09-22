import Image from "next/image";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import type { Product } from "@/lib/types";
import styles from "./ProductCard.module.css";

/**
 * The card is the framed object, so the image inside it carries no frame of
 * its own: nesting one blueprint in another draws two sets of registration
 * marks a few pixels apart.
 *
 * No price, by design. Nothing on this site is priced, and the live site's
 * "1 QAR" placeholder is on 592 of its 596 products.
 */
export function ProductCard({
  product,
  locale,
  t,
  priority = false,
}: {
  product: Product;
  locale: Locale;
  t: Dictionary;
  priority?: boolean;
}) {
  const href = routes.product(product.slug, locale);

  return (
    <article className={`card blueprint ${styles.card}`}>
      <Link className={styles.media} href={href} tabIndex={-1} aria-hidden="true">
        <Image
          src={product.image.src}
          alt={product.image.alt}
          width={product.image.width}
          height={product.image.height}
          sizes="(max-width: 48rem) 50vw, (max-width: 72rem) 33vw, 20rem"
          priority={priority}
        />
      </Link>

      <div className={styles.body}>
        <span className={styles.kicker}>{product.type.name}</span>
        <h3 className={styles.title}>
          <Link href={href}>{product.name}</Link>
        </h3>
        {product.dimensions && <p className={styles.dim}>{product.dimensions}</p>}
        <div className={styles.meta}>
          <span>{product.sku}</span>
          {product.finishes.length > 0 && (
            <span>
              {product.finishes.length} {t.common.finishes.toLowerCase()}
            </span>
          )}
        </div>
        <Link
          className={`btn btn-quote btn-block ${styles.cta}`}
          href={routes.quote(product.sku, locale)}
        >
          {t.common.requestQuote}
        </Link>
      </div>
    </article>
  );
}
