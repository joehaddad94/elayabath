import type { MetadataRoute } from "next";
import { getCategories, getProducts } from "@/lib/catalogue";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";
import { routes } from "@/lib/routes";

const ORIGIN = "https://elayabath.com";

/**
 * Every route the build generates, at its canonical URL. The locale segment
 * is deliberately absent: it is rewritten away, so the clean path is the one
 * that should be indexed.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const l = DEFAULT_LOCALE;

  const staticRoutes = [
    { path: routes.home(l), priority: 1 },
    { path: routes.products(l), priority: 0.9 },
    { path: routes.about(l), priority: 0.7 },
    { path: routes.contact(l), priority: 0.7 },
    { path: routes.catalogue(l), priority: 0.6 },
    { path: routes.faq(l), priority: 0.5 },
    { path: routes.search(l), priority: 0.3 },
    { path: routes.privacy(l), priority: 0.2 },
    { path: routes.terms(l), priority: 0.2 },
    { path: routes.returns(l), priority: 0.2 },
  ];

  return [
    ...staticRoutes.map(({ path, priority }) => ({
      url: `${ORIGIN}${path}`,
      priority,
    })),
    ...getCategories().map((c) => ({
      url: `${ORIGIN}${routes.category(c.slug, l)}`,
      priority: 0.8,
    })),
    ...getProducts().map((p) => ({
      url: `${ORIGIN}${routes.product(p.slug, l)}`,
      priority: 0.6,
    })),
  ];
}
