import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { DEFAULT_THEME, themeInitScript } from "@/lib/theme";
import "@/styles/globals.css";

/* The design system asks for Barlow Condensed over Barlow. Loading them
   through next/font rather than the system stylesheet's @import means they
   are self-hosted, preloaded and not render-blocking, and there is no
   layout shift as they swap in. */
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-barlow",
  display: "swap",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://elayabath.com"),
  title: {
    default: "Elaya Bath — Because Bathrooms Matter",
    template: "%s — Elaya Bath",
  },
  description:
    "ELAYA BATH was founded with a vision to revolutionize the sanitary ware industry by merging innovative technology with stunning design.",
};

export const viewport: Viewport = {
  // Both grounds are declared so the browser chrome matches whichever
  // palette is applied, rather than flashing the wrong one on mobile.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#17191b" },
    { media: "(prefers-color-scheme: light)", color: "#e6e0d5" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme={DEFAULT_THEME}
      className={`${barlow.variable} ${barlowCondensed.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies a stored palette before first paint. Without this a
            visitor who chose Stone sees Ink flash first. */}
        <script
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
