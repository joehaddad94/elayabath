import { Icon } from "@/components/Icon/Icon";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";
import styles from "./SiteHeader.module.css";

/**
 * A real field in the header rather than an icon linking to a search page.
 *
 * The catalogue is item-code driven. Every product carries a code like
 * E02-SW40034, the data sheets are named after it, and the site's own FAQ
 * tells people that if they have the code they should skip the browsing. The
 * header was making them load a page before they could begin typing.
 *
 * A plain GET form, so it submits without JavaScript and lands on /search
 * with the query in the URL, which is also a link somebody can share. The
 * search page seeds its field from that parameter.
 *
 * On narrow screens the field collapses back to the icon: the header there is
 * already two rows and a phone keyboard covers the results anyway.
 */
export function HeaderSearch({ locale, t }: { locale: Locale; t: Dictionary }) {
  return (
    <form className={styles.search} action={routes.search(locale)} method="get" role="search">
      <label className="sr-only" htmlFor="header-search">
        {t.nav.search}
      </label>
      <input
        id="header-search"
        className={styles.searchInput}
        type="search"
        name="q"
        autoComplete="off"
        placeholder={t.nav.searchPlaceholder}
      />
      <button className={styles.searchGo} type="submit" aria-label={t.nav.searchSubmit}>
        <Icon name="search" />
      </button>

      {/* The same destination for anyone whose viewport has collapsed the
          field away, so search is never unreachable. */}
      <a className={styles.searchIcon} href={routes.search(locale)} aria-label={t.nav.search}>
        <Icon name="search" />
      </a>
    </form>
  );
}
