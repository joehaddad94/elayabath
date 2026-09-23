"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon/Icon";
import { readFinish } from "@/lib/product-finish";
import {
  addToShortlist,
  getShortlistServerSnapshot,
  getShortlistSnapshot,
  parseShortlist,
  removeFromShortlist,
  subscribeToShortlist,
} from "@/lib/shortlist";
import {
  getSearch,
  getServerSearch,
  subscribeToSearch,
} from "@/lib/url-filters";

/**
 * Adds one product to the enquiry shortlist, and takes it off again.
 *
 * On a product page it also picks up whichever finish is selected, by reading
 * the same URL parameter the picker writes, so the shortlist records the
 * variant rather than just the item.
 *
 * `codeFor` is passed in rather than looked up: a client component must never
 * import the catalogue. On a card there is no picker, so it is empty.
 */
export function ShortlistButton({
  sku,
  slug,
  name,
  addLabel,
  addedLabel,
  className = "",
  codeFor = {},
}: {
  sku: string;
  slug: string;
  name: string;
  addLabel: string;
  addedLabel: string;
  className?: string;
  codeFor?: Record<string, string>;
}) {
  const raw = useSyncExternalStore(
    subscribeToShortlist,
    getShortlistSnapshot,
    getShortlistServerSnapshot,
  );
  const search = useSyncExternalStore(
    subscribeToSearch,
    getSearch,
    getServerSearch,
  );

  const items = useMemo(() => parseShortlist(raw), [raw]);
  const added = items.some((i) => i.sku === sku);

  const finishSlug = readFinish(search);
  const finish = finishSlug ? codeFor[finishSlug] : undefined;

  return (
    <button
      type="button"
      className={`btn ${added ? "btn-primary" : "btn-secondary"} ${className}`}
      aria-pressed={added}
      onClick={() =>
        added
          ? removeFromShortlist(sku)
          : addToShortlist({ sku, slug, name, ...(finish ? { finish } : {}) })
      }
    >
      <Icon name={added ? "check" : "plus"} size={15} />
      {added ? addedLabel : addLabel}
    </button>
  );
}
