"use client";

import { useEffect } from "react";
import { confirmOutsideReact, navigateOutsideReact } from "./ConfirmDialog";

/**
 * Asks before unsaved work is thrown away.
 *
 * A click on a link inside the dashboard: Next navigates without unloading
 * the page, so the edits would vanish without a word. One listener on the
 * whole document, in the capture phase so it runs before Next's own handler,
 * holds the click, asks in the dashboard's dialog, and follows the link only
 * if the person chooses to leave.
 *
 * Closing or reloading the tab: that question can only be the browser's own
 * (`beforeunload`); browsers allow no custom dialog there.
 *
 * Several parts of one screen can hold unsaved work at once (a category's
 * fields and its product order); they share the listener, so the question is
 * asked once. The browser's back button is the one route it can't ask about.
 */
const active = new Map<symbol, string>();
// Set once the person has chosen to leave, so a link that reloads the page
// (to the public site) doesn't then ask a second time in the browser's words.
let leaving = false;

function onUnload(e: BeforeUnloadEvent) {
  if (active.size && !leaving) e.preventDefault();
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

  e.preventDefault();
  e.stopPropagation();
  const body = active.size === 1 ? [...active.values()][0]! : "You have unsaved changes on this page.";
  void confirmOutsideReact({ title: "Leave this page?", body, confirmLabel: "Leave", cancelLabel: "Stay", danger: true }).then((go) => {
    if (!go) return;
    leaving = true;
    navigateOutsideReact(to.pathname + to.search + to.hash);
  });
}

export function useUnsavedGuard(dirty: boolean, message = "You have unsaved changes. They are lost if you leave now.") {
  useEffect(() => {
    if (!dirty) return;
    const key = Symbol("unsaved");
    if (active.size === 0) {
      leaving = false;
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
