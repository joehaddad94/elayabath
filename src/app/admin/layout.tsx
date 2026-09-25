import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import { DEFAULT_THEME, themeInitScript } from "@/lib/theme";
import "@/styles/globals.css";

/**
 * The dashboard's own root layout.
 *
 * Separate from the public site's, which lives under the [locale] segment:
 * the dashboard is English-only by decision, is never indexed, and has none
 * of the site's header, footer or structured data. It shares the fonts, the
 * design tokens and the palette switch, so it reads as part of the same
 * product.
 */
export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Elaya Bath dashboard" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#17191b" },
    { media: "(prefers-color-scheme: light)", color: "#e6e0d5" },
  ],
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      data-theme={DEFAULT_THEME}
      className={fontVariables}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
