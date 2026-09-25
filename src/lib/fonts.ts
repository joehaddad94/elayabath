import { Barlow, Barlow_Condensed } from "next/font/google";

/**
 * The site's two typefaces, declared once and shared by both root layouts:
 * the public site and the dashboard. next/font self-hosts and preloads them,
 * so neither layout pays for a render-blocking stylesheet.
 */

/* The design system asks for Barlow Condensed over Barlow. Loading them
   through next/font rather than the system stylesheet's @import means they
   are self-hosted, preloaded and not render-blocking, with no layout shift
   as they swap in. */
const barlow = Barlow({
  subsets: ["latin"],
  // Only 400 is ever painted: the system sets headings in Barlow Condensed at
  // --font-heading-weight, and nothing calls for a medium or bold body face.
  // Loading 500 and 700 shipped two font files per page for nothing.
  weight: ["400"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

/** Both variables, for a root element's className. */
export const fontVariables = `${barlow.variable} ${barlowCondensed.variable}`;
