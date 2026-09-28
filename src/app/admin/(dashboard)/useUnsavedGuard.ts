"use client";

import { useEffect } from "react";

/**
 * Asks before unsaved work is thrown away.
 *
 * Closing or reloading the tab is covered by the browser's own prompt
 * (`beforeunload`). A click on a link inside the dashboard is not: Next
 * navigates without unloading the page, so the edits would vanish without a
 * word. One listener on the whole document, in the capture phase so it runs
 * before Next's own handler, cancels the click if the person chooses to stay.
 *
 * Several parts of one screen can hold unsaved work at once (a category's
 * fields and its product order); they share the listener, so the question is
 * asked once, not once per part. The browser's back button is the one route
 * it can't ask about.
 */
const active = new Map<symbol, string>();

function onUnload(e: BeforeUnloadEvent) {
  if (active.size) e.preventDefault();
}

function onClick(e: MouseEvent) {
  if (!active.size) return;
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const link = (e.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return;
  if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;
  const to = new URL(link.href, window.location.href);
  if (to.origin !== window.location.origin) return;
  // A link to this same page loses nothing.
  if (to.pathname === window.location.pathname && to.search === window.location.search) return;
  const message = active.size === 1 ? [...active.values()][0]! : "You have unsaved changes on this page. Leave without saving them?";
  if (!window.confirm(message)) {
    e.preventDefault();
    e.stopPropagation();
  }
}

export function useUnsavedGuard(dirty: boolean, message = "You have unsaved changes. Leave without saving them?") {
  useEffect(() => {
    if (!dirty) return;
    const key = Symbol("unsaved");
    if (active.size === 0) {
      window.addEventListener("beforeunload", onUnload);
      document.addEventListener("click", onClick, true);
    }
    active.set(key, message);
    return () => {
      active.delete(key);
      if (active.size === 0) {
        window.removeEventListener("beforeunload", onUnload);
        document.removeEventListener("click", onClick, true);
      }
    };
  }, [dirty, message]);
}
