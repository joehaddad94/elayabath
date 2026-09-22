/**
 * The theme is external state: it lives on <html data-theme>, is written by
 * an inline script before React exists, and persists in localStorage. React
 * subscribes to it rather than owning it, which is exactly what
 * useSyncExternalStore is for.
 *
 * Doing it any other way fights the framework. Reading the DOM in an effect
 * and calling setState causes a cascading render the compiler rejects, and
 * holding the theme in React state instead would mean the first paint could
 * not know it.
 */

import { DEFAULT_THEME, isTheme, THEME_STORAGE_KEY, type Theme } from "./theme";

const listeners = new Set<() => void>();

export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function getSnapshot(): Theme {
  const applied = document.documentElement.dataset.theme;
  return isTheme(applied) ? applied : DEFAULT_THEME;
}

/** During render on the server there is no DOM, and the document is emitted
 *  with DEFAULT_THEME, so this must agree with it. */
export function getServerSnapshot(): Theme {
  return DEFAULT_THEME;
}

export function applyTheme(next: Theme): void {
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // Private window with site data blocked. The choice still applies to this
    // page view, it just will not be remembered.
  }
  for (const listener of listeners) listener();
}
