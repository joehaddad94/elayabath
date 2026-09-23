"use client";

import { useEffect } from "react";

/**
 * Opens the question a link points at.
 *
 * Without this, sending somebody `/faq#q-why-are-there-no-prices` scrolls
 * them to a closed row and leaves them to work out that they have to click
 * it, which defeats the point of a linkable answer.
 *
 * Chromium and Safari now expand a `<details>` when a fragment targets it,
 * but not every browser does and not every version people are on, so the
 * behaviour is made explicit rather than assumed. Where the browser handles
 * it already, this is a no-op: the element is opened once either way.
 *
 * It renders nothing. This is the one piece of the FAQ that needs
 * JavaScript, and the page is entirely usable without it: the accordion
 * itself is a native `<details>`.
 */
export function OpenTargetedQuestion() {
  useEffect(() => {
    const open = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (target instanceof HTMLDetailsElement && !target.open) {
        target.open = true;
        // The row grows as it opens, so the scroll the browser already did
        // now points at the wrong place.
        target.scrollIntoView({ block: "start", behavior: "auto" });
      }
    };

    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);

  return null;
}
