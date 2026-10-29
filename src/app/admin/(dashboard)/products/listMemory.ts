"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * What the Products list remembers for the product editor, in this tab only:
 * the list's address (its search and filters), the products it showed in
 * order, and the product last opened from it. So the editor's "Products"
 * link returns to the same filtered list, at the same product, and the
 * editor can offer the previous and next product of that list.
 */
export interface ListMemory {
  href: string;
  ids: string[];
  lastId?: string;
}

const KEY = "elaya:products-list";

function read(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberList(update: Partial<ListMemory>) {
  try {
    const current = JSON.parse(read() ?? "null") as ListMemory | null;
    window.sessionStorage.setItem(KEY, JSON.stringify({ href: "/admin/products", ids: [], ...current, ...update }));
  } catch {
    // Private windows may refuse storage; the list still works, it just
    // won't be remembered.
  }
}

/** Storage set by this same tab fires no event, and nothing here needs to
 *  follow another tab, so the snapshot is read once per render. */
const subscribe = () => () => {};

/** The remembered list, or null on the server and before anything is
 *  remembered. */
export function useListMemory(): ListMemory | null {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => {
    try {
      return raw ? (JSON.parse(raw) as ListMemory) : null;
    } catch {
      return null;
    }
  }, [raw]);
}
