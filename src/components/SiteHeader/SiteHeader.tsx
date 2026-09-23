import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle/ThemeToggle";
import { getCategories } from "@/lib/catalogue";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import { HeaderSearch } from "./HeaderSearch";
import { NavLinks } from "./NavLinks";
import styles from "./SiteHeader.module.css";

/**
 * Follows the live site's navigation order, with three removals.
 *
 * "Model" is gone: that page is 15 bytes on the live site and contains
 * nothing at all, yet sits in the main navigation. Wishlist and My account
 * are gone with the cart, because the commercial model is browse then quote
 * and there is nothing to sign in to.
 */
export function SiteHeader({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);

  // Read here, in a server component, and handed down as plain data. NavLinks
  // is a client component and must never import the catalogue itself.
  const categories = getCategories();

  const items = [
    { href: routes.about(locale), label: t.nav.about },
    {
      href: routes.products(locale),
      label: t.nav.products,
      match: [routes.productSection(locale)],
      panelAllLabel: t.nav.allProducts,
      panel: categories.map((category) => ({
        href: routes.category(category.slug, locale),
        label: category.name,
        count: category.count,
      })),
    },
    { href: routes.catalogue(locale), label: t.nav.catalogue },
    { href: routes.contact(locale), label: t.nav.contact },
  ];

  return (
    <>
      <a className={styles.skip} href="#main">
        {t.nav.skipToContent}
      </a>

      <header className={styles.head}>
        <nav className={styles.nav} aria-label={t.nav.label}>
          <Link className={styles.brand} href={routes.home(locale)}>
            <Image
              src="/logo.png"
              alt={t.brand.name}
              // The file is 1140x557. The previous 160x53 claimed a 3.02
              // aspect against the real 2.05, so next/image reserved a box
              // of the wrong shape until the image loaded.
              width={1140}
              height={557}
              sizes="72px"
              priority
              className="invert-on-dark"
            />
          </Link>

          <NavLinks items={items} />

          <div className={styles.tools}>
            <HeaderSearch locale={locale} t={t} />
            <ThemeToggle label={t.nav.switchTo} />
          </div>
        </nav>
      </header>
    </>
  );
}
