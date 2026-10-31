import type { Metadata, Viewport } from "next";
import { fontVariables } from "@/lib/fonts";
import "@/styles/globals.css";
import styles from "./admin.module.css";

/**
 * The dashboard's own root layout.
 *
 * Separate from the public site's, which lives under the [locale] segment:
 * the dashboard is English-only by decision, is never indexed, and has none
 * of the site's header, footer or structured data. It shares the fonts, the
 * design tokens and the brand palette, so it reads as part of the same
 * product.
 */
export const metadata: Metadata = {
  title: { default: "Dashboard", template: "%s · Elaya Bath dashboard" },
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  themeColor: "#f0ede6",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={fontVariables}
    >
      <body className={styles.root}>{children}</body>
    </html>
  );
}
