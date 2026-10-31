import { Cormorant_Garamond, Poppins } from "next/font/google";

/**
 * The brand's two typefaces, from the client's brand guidelines, declared once
 * and shared by both root layouts: the public site and the dashboard.
 * next/font self-hosts and preloads them, so neither layout pays for a
 * render-blocking stylesheet.
 *
 * The guidelines' rule: the serif for titles, the sans-serif for information.
 * Don't mix them up.
 */

/* Titles, and italic for accent lines and taglines. 500 rather than 400 for
   headings: Cormorant's hairlines thin out on screen at 400. */
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

/* Everything that informs: body text, series names in capitals, item codes,
   labels, and "ELAYA BATH" in spaced capitals. 400 for running text, 500 for
   emphasis and series names, 600 only for the dashboard's counts. */
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});

/** Both variables, for a root element's className. */
export const fontVariables = `${cormorant.variable} ${poppins.variable}`;
