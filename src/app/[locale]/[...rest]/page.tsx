import { notFound } from "next/navigation";

/**
 * Anything under the locale that matches no real route.
 *
 * Without this, an unmatched path falls through to Next's own built-in 404,
 * which has no layout: no header, no footer, no theme, no fonts. A visitor
 * who mistypes a URL gets a bare white page with "404: This page could not be
 * found." on it.
 *
 * Calling notFound() here sends them to [locale]/not-found.tsx instead, which
 * renders inside the site shell like every other page.
 */
export default function CatchAll(): never {
  notFound();
}
