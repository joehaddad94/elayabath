import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/Icon/Icon";
import { ThemeToggle } from "@/components/ThemeToggle/ThemeToggle";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
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

  const items = [
    { href: routes.about(locale), label: t.nav.about },
    { href: routes.products(locale), label: t.nav.products },
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
              width={160}
              height={53}
              priority
              className="invert-on-dark"
            />
          </Link>

          <NavLinks items={items} />

          <div className={styles.tools}>
            <Link
              className="btn btn-icon"
              href={routes.search(locale)}
              aria-label={t.nav.search}
            >
              <Icon name="search" />
            </Link>
            <ThemeToggle label={t.nav.palette} />
          </div>
        </nav>
      </header>
    </>
  );
}
