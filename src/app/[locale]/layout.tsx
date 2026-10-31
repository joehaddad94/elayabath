import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd/JsonLd";
import { fontVariables } from "@/lib/fonts";
import { SiteFooter } from "@/components/SiteFooter/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader/SiteHeader";
import { LOCALES, directionOf, isLocale } from "@/lib/i18n/config";
import { SITE_ORIGIN } from "@/lib/site";
import { getDictionary } from "@/lib/i18n";
import { organizationSchema, websiteSchema } from "@/lib/seo";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  // The default for every page. Each page overrides it with its own
  // path; without this the home page would have none, since it has no
  // metadata export of its own.
  alternates: { canonical: "/" },
  title: {
    default: "Elaya Bath — Soft curves, effortless flow",
    template: "%s — Elaya Bath",
  },
  description:
    "Sanitary ware shaped by soft curves and lasting, considered design.",
  openGraph: {
    type: "website",
    siteName: "Elaya Bath",
    images: ["/rooms/contact-banner.webp"],
  },
};

export const viewport: Viewport = {
  // Warm Cream, the brand's page ground. One palette, so one colour.
  themeColor: "#f0ede6",
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
      className={fontVariables}
    >
      <body>
        {/* Sitewide, so the publisher is stated once and every other node
            can point at it by @id rather than repeating itself. */}
        <JsonLd
          graph={[
            organizationSchema(getDictionary(locale).contactAddresses),
            websiteSchema(),
          ]}
        />
        <SiteHeader locale={locale} />
        {children}
        <SiteFooter locale={locale} />
      </body>
    </html>
  );
}
