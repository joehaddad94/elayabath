/**
 * The enquiry shortlist.
 *
 * Every quote button on the site carried exactly one item code, which does
 * not match how the thing is bought: somebody specifying a bathroom wants a
 * basin, a tap and a WC quoted together, and was being asked to send three
 * enquiries or to type the codes out by hand.
 *
 * Kept in localStorage rather than the URL, because unlike a filtered shelf
 * this is a private working set that has to survive moving between products,
 * and it is nobody else's business when a link is shared.
 *
 * The snapshot is the raw stored string, deliberately. `useSyncExternalStore`
 * compares snapshots with Object.is, so returning a freshly parsed array on
 * every call would loop forever; a string compares by value. Components parse
 * it once in a `useMemo`.
 *
 * Every access is wrapped: localStorage throws outright in a private window
 * with site data blocked, and the site has to keep working when it does. In
 * that case the shortlist simply never persists, which is the correct
 * degradation for something that is an accelerator rather than a dependency.
 */

export const SHORTLIST_KEY = "elaya-shortlist";

/** Small on purpose: this is written to storage and read on every page. The
 *  name is carried so the contact page can list the items without importing
 *  the catalogue into the browser. */
export interface ShortlistItem {
  sku: string;
  slug: string;
  name: string;
  /** The finish code chosen on the product page, where one was. */
  finish?: string;
}

const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(SHORTLIST_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function write(items: ShortlistItem[]): void {
  try {
    localStorage.setItem(SHORTLIST_KEY, JSON.stringify(items));
  } catch {
    /* private window, or storage full: the session continues without it */
  }
  for (const listener of listeners) listener();
}

export function subscribeToShortlist(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab is the same person with the same shortlist.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function getShortlistSnapshot(): string {
  return read();
}

/** Empty during server render, so the markup never claims a shortlist the
 *  visitor may not have. */
export function getShortlistServerSnapshot(): string {
  return "[]";
}

/** Tolerates anything in storage: it is user-writable and survives releases,
 *  so a shape change must degrade to an empty list rather than a crash. */
export function parseShortlist(raw: string): ShortlistItem[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ShortlistItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as ShortlistItem).sku === "string" &&
        typeof (item as ShortlistItem).slug === "string" &&
        typeof (item as ShortlistItem).name === "string",
    );
  } catch {
    return [];
  }
}

/** Adding an item already present updates its finish rather than duplicating
 *  it: choosing a different finish and adding again is a correction, not a
 *  second line. */
export function addToShortlist(item: ShortlistItem): void {
  const items = parseShortlist(read());
  const existing = items.findIndex((i) => i.sku === item.sku);
  if (existing >= 0) {
    items[existing] = item;
  } else {
    items.push(item);
  }
  write(items);
}

export function removeFromShortlist(sku: string): void {
  write(parseShortlist(read()).filter((i) => i.sku !== sku));
}

export function clearShortlist(): void {
  write([]);
}

/** The value the enquiry form's item-code field is filled with. Its own hint
 *  already told people to separate several with commas. */
export function shortlistCodes(items: ShortlistItem[]): string {
  return items.map((i) => i.sku).join(", ");
}

export function shortlistFinishes(items: ShortlistItem[]): string {
  return items
    .filter((i) => i.finish)
    .map((i) => `${i.sku}: ${i.finish}`)
    .join(", ");
}
