"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { Locale } from "@/lib/i18n/config";
import { readFinish } from "@/lib/product-finish";
import { routes } from "@/lib/routes";
import {
  getSearch,
  getServerSearch,
  subscribeToSearch,
} from "@/lib/url-filters";

/**
 * The quote link on a product page, which has to know the finish the visitor
 * is currently looking at.
 *
 * A client component for one reason: the finish lives in the URL and this
 * href changes with it. Everything else on the page stays server-rendered.
 *
 * `codeFor` maps a finish slug to the code the client actually quotes
 * against, `ss04-thunder` to `SS04`. It is passed in rather than looked up,
 * because a client component must never import the catalogue.
 */
export function QuoteAction({
  sku,
  locale,
  label,
  className,
  codeFor,
}: {
  sku: string;
  locale: Locale;
  label: string;
  className: string;
  codeFor: Record<string, string>;
}) {
  const search = useSyncExternalStore(
    subscribeToSearch,
    getSearch,
    getServerSearch,
  );
  const slug = readFinish(search);
  const code = slug ? codeFor[slug] : undefined;

  return (
    <Link className={className} href={routes.quote(sku, locale, code)}>
      {label}
    </Link>
  );
}
