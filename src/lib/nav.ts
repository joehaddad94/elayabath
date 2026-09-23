import { stripLocale } from "./i18n/config";

/**
 * Whether a navigation item represents the page currently being viewed.
 *
 * Pure and data-free on purpose: this lives outside the client component so
 * it can be tested without a DOM, and so the rule it encodes is written down
 * in one place rather than inline in JSX.
 *
 * Two things it has to get right, both of which were previously wrong.
 *
 * The pathname arrives with a locale segment and the href does not, so they
 * are normalised before comparison.
 *
 * And a section is not always a prefix of its own item's href. A product
 * detail page lives at `/product/<slug>`, singular, which is not under
 * `/products`. Passing the extra roots in `match` is what lets the
 * navigation light up "Products" while you are looking at one.
 */
export function isActive(pathname: string, href: string, match?: string[]): boolean {
  const here = stripLocale(pathname);
  const roots = [href, ...(match ?? [])];

  return roots.some((root) => {
    const target = stripLocale(root);
    if (target === "/") return here === "/";
    return here === target || here.startsWith(`${target}/`);
  });
}
