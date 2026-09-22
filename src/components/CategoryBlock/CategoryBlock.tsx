import Image from "next/image";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import type { Category } from "@/lib/types";
import styles from "./CategoryBlock.module.css";

/**
 * One category, with the client's own copy where they have written any.
 * Only three categories have a paragraph; the rest carry none at all, which
 * is why this renders nothing rather than inventing a description.
 *
 * The caption names the category and what is in the frame, not a product.
 * A room shot is not one product, so naming a SKU under it would be a claim
 * the photograph does not support.
 */
export function CategoryBlock({
  category,
  caption,
  locale,
  t,
  flip = false,
}: {
  category: Category;
  caption: string;
  locale: Locale;
  t: Dictionary;
  flip?: boolean;
}) {
  return (
    <article className={`${styles.block} ${flip ? styles.flip : ""}`}>
      <div className={styles.grid}>
        <div className={styles.copy}>
          <div className={styles.head}>
            {category.icon && (
              <Image
                src={category.icon}
                alt=""
                aria-hidden="true"
                width={37}
                height={37}
                className="invert-on-dark"
              />
            )}
            <h3>{category.name}</h3>
          </div>

          {category.blurb?.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}

          <div className={styles.actions}>
            <Link
              className="btn btn-secondary"
              href={routes.category(category.slug, locale)}
            >
              {t.common.shopTheSelection}
            </Link>
          </div>
        </div>

        <div className={styles.media}>
          {category.image && (
            <figure className={`${styles.figure} blueprint`}>
              <Image
                src={category.image}
                alt={caption}
                width={817}
                height={670}
                sizes="(max-width: 58rem) 100vw, 40rem"
              />
              <figcaption>
                <span>{category.name}</span>
                <span>{category.count} {t.common.products.toLowerCase()}</span>
              </figcaption>
            </figure>
          )}
        </div>
      </div>
    </article>
  );
}
