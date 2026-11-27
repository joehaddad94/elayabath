import Image from "next/image";
import Link from "next/link";
import { format, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import type { Collection } from "@/lib/types";
import styles from "./CollectionGrid.module.css";

/** "3 products", or "1 product". */
export function collectionCount(t: Dictionary, n: number): string {
  return n === 1 ? t.collection.countOne : format(t.collection.count, { n });
}

/**
 * Collections as cards, the way the site lists the range: a category page
 * shows its own, All collections shows every one. Each opens its
 * collection's page.
 *
 * The photo is the collection's own where staff have set one (a room shot,
 * cropped to fill), or else its first product's (a cut-out, shown whole on
 * the card's ground, as a product card shows it).
 */
export function CollectionGrid({
  collections,
  locale,
  t,
  showCategory = false,
  priorityCount = 0,
}: {
  collections: Collection[];
  locale: Locale;
  t: Dictionary;
  /** On a page that mixes categories, name each card's category. */
  showCategory?: boolean;
  priorityCount?: number;
}) {
  return (
    <div className={styles.grid}>
      {collections.map((collection, index) => {
        const href = routes.collection(collection.categorySlug, collection.slug, locale);
        return (
          <article key={`${collection.categorySlug}/${collection.slug}`} className={`card blueprint ${styles.card}`}>
            <Link className={styles.media} href={href} tabIndex={-1} aria-hidden="true">
              {collection.image ? (
                <Image
                  src={collection.image.src}
                  alt=""
                  width={collection.image.width}
                  height={collection.image.height}
                  sizes="(max-width: 48rem) 50vw, (max-width: 72rem) 33vw, 20rem"
                  className={collection.image.product ? styles.cutout : styles.photo}
                  priority={index < priorityCount}
                />
              ) : (
                <span className={styles.noPhoto}>{t.common.noPhoto}</span>
              )}
            </Link>
            <div className={styles.body}>
              {showCategory && <span className={styles.kicker}>{collection.categoryName}</span>}
              <h3 className={styles.title}>
                <Link href={href}>{collection.name}</Link>
              </h3>
              <div className={styles.meta}>
                <span>{collectionCount(t, collection.count)}</span>
              </div>
              <Link className={`btn btn-quote btn-block ${styles.cta}`} href={href}>
                {t.collection.view}
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}
