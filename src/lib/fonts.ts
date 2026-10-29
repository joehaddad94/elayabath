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
  // 400 for running text, 600 for emphasis (the dashboard's counts, errors,
  // flags and <strong>). Without the 600 file the browser fakes a bold by
  // thickening the 400, which smears on Safari and Windows.
  weight: ["400", "600"],
  variable: "--font-barlow",
  display: "swap",
});

// Headings and buttons only, always at --font-heading-weight. A 400 used to
// be loaded for a single SKU label, which now sets in Barlow instead.
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

/** Both variables, for a root element's className. */
export const fontVariables = `${barlow.variable} ${barlowCondensed.variable}`;
