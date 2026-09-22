/**
 * Filter state lives in the URL, not in React.
 *
 * That makes a filtered shelf a linkable thing, and it means the component
 * has one source of truth rather than two that can disagree. React subscribes
 * to the URL through useSyncExternalStore, which is the primitive for exactly
 * this: state owned by the platform, not the component.
 *
 * Written with replaceState rather than a router push, because filtering a
 * shelf should not leave twenty history entries to back out of. Back still
 * works: popstate is subscribed to, so the browser's own navigation is
 * reflected.
 */

const listeners = new Set<() => void>();

export function subscribeToSearch(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("popstate", onChange);
  };
}

/** A primitive, so useSyncExternalStore can compare snapshots by value. */
export function getSearch(): string {
  return window.location.search;
}

export function getServerSearch(): string {
  return "";
}

export function setSearch(params: URLSearchParams): void {
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    query ? `?${query}` : window.location.pathname,
  );
  for (const listener of listeners) listener();
}
