import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader/SiteHeader";
import { LOCALES, directionOf, isLocale } from "@/lib/i18n/config";
import { DEFAULT_THEME, themeInitScript } from "@/lib/theme";
import "@/styles/globals.css";

/* The design system asks for Barlow Condensed over Barlow. Loading them
   through next/font rather than the system stylesheet's @import means they
   are self-hosted, preloaded and not render-blocking, with no layout shift
   as they swap in. */
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
  openGraph: {
    type: "website",
    siteName: "Elaya Bath",
    images: ["/rooms/hero-room.webp"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#17191b" },
    { media: "(prefers-color-scheme: light)", color: "#e6e0d5" },
  ],
};

/** One locale today. The segment exists so adding Arabic is a dictionary and
 *  a font, not a routing migration. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Next 16: params is a Promise. Synchronous access was removed.
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale = raw;

  return (
    <html
      lang={locale}
      dir={directionOf(locale)}
      data-theme={DEFAULT_THEME}
      className={`${barlow.variable} ${barlowCondensed.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies a stored palette before first paint. Without this, a
            visitor who chose Stone sees Ink flash first. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <SiteHeader locale={locale} />
        {children}
        <SiteFooter locale={locale} />
      </body>
    </html>
  );
}
